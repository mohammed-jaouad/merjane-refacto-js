import {
	describe, it, expect, beforeEach,
	afterEach,
} from 'vitest';
import {mockDeep, type DeepMockProxy} from 'vitest-mock-extended';
import {type INotificationService} from '../notifications.port.js';
import {createDatabaseMock, cleanUp} from '../../utils/test-utils/database-tools.ts.js';
import {ProductService} from './product.service.js';
import {products, type Product} from '@/db/schema.js';
import {type Database} from '@/db/type.js';
import { ProductRepository } from '@/repos/product.respository.js';


// tests dates 
const DAYS = 24 * 60 * 60 * 1000;
const daysFromNow = (days: number) => new Date(Date.now() + (days * DAYS));


describe('ProductService Tests', () => {
	let notificationServiceMock: DeepMockProxy<INotificationService>;
	let productService: ProductService;
	let databaseMock: Database;
	let databaseName: string;
	let closeDatabase: () => void;

	beforeEach(async () => {
		({databaseMock, databaseName, close: closeDatabase} = await createDatabaseMock());
		notificationServiceMock = mockDeep<INotificationService>();
		productService = new ProductService({
			ns: notificationServiceMock,
			productRepository: new ProductRepository({db: databaseMock}),
		});
	});

	afterEach(async () => {
		closeDatabase();
		await cleanUp(databaseName);
	});

	// Creer un produit
	function createProduct(overrides: Partial<Product>): Product {
		return {
			id: 1,
			leadTime: 15,
			available: 30,
			type: 'NORMAL',
			name: 'Product',
			expiryDate: null,
			seasonStartDate: null,
			seasonEndDate: null,
			...overrides,
		};
	}

	// Inserer le produit dans la db 
	async function processAndReload(product: Product) {
		await databaseMock.insert(products).values(product);
		await productService.processProduct(product);
		return databaseMock.query.products.findFirst({where: (p, {eq}) => eq(p.id, product.id)});
	}

	it('should handle delay notification correctly', async () => {
		// GIVEN
		const product: Product = {
			id: 1,
			leadTime: 15,
			available: 0,
			type: 'NORMAL',
			name: 'RJ45 Cable',
			expiryDate: null,
			seasonStartDate: null,
			seasonEndDate: null,
		};
		await databaseMock.insert(products).values(product);

		// WHEN
		await productService.processProduct(product);

		// THEN
		expect(product.available).toBe(0);
		expect(product.leadTime).toBe(15);
		expect(notificationServiceMock.sendDelayNotification).toHaveBeenCalledWith(product.leadTime, product.name);
		const result = await databaseMock.query.products.findFirst({
			where: (p, {eq}) => eq(p.id, product.id),
		});
		expect(result).toEqual(product);
	});


	// Test normal, les deux cas
	describe('NORMAL', () => {
		it('decremente le stock quand disponible', async () => {
			const result = await processAndReload(createProduct({available: 30}));
			expect(result!.available).toBe(29);
			expect(notificationServiceMock.sendDelayNotification).not.toHaveBeenCalled();
		});

		it('ne fait rien quand c\'est out of stock sans lead time', async () => {
			const result = await processAndReload(createProduct({available: 0, leadTime: 0}));
			expect(result!.available).toBe(0);
			expect(notificationServiceMock.sendDelayNotification).not.toHaveBeenCalled();
		});
	});

	// Seasonier
	describe('SEASONAL', () => {
		const inSeason = {type: 'SEASONAL', seasonStartDate: daysFromNow(-2), seasonEndDate: daysFromNow(58)};

		it('decremente le stock quand c\'est la saison et dispo', async () => {
			const result = await processAndReload(createProduct({...inSeason, available: 30}));
			expect(result!.available).toBe(29);
			expect(notificationServiceMock.sendOutOfStockNotification).not.toHaveBeenCalled();
		});

		it('notifie quand c\'est out of stock et le reaprovsionement est durant la saison', async () => {
			const result = await processAndReload(createProduct({
				...inSeason, available: 0, leadTime: 15, name: 'Watermelon',
			}));
			expect(result!.available).toBe(0);
			expect(notificationServiceMock.sendDelayNotification).toHaveBeenCalledWith(15, 'Watermelon');
		});

		it('le mettre en non dispo quand le reaprovisonment depasse la saison', async () => {
			const result = await processAndReload(createProduct({
				...inSeason, available: 0, leadTime: 90, name: 'Watermelon',
			}));
			expect(result!.available).toBe(0);
			expect(notificationServiceMock.sendOutOfStockNotification).toHaveBeenCalledWith('Watermelon');
			expect(notificationServiceMock.sendDelayNotification).not.toHaveBeenCalled();
		});

		it('notifies out of stock quand la saison n\'a pas encore commencé', async () => {
			const result = await processAndReload(createProduct({
				type: 'SEASONAL', seasonStartDate: daysFromNow(180), seasonEndDate: daysFromNow(240), available: 30, name: 'Grapes',
			}));
			expect(result!.available).toBe(30);
			expect(notificationServiceMock.sendOutOfStockNotification).toHaveBeenCalledWith('Grapes');
		});
	});

	// Expirable
	describe('EXPIRABLE', () => {
		it('retire du stock quand ce n\' est pas expiré et dispo', async () => {
			const result = await processAndReload(createProduct({type: 'EXPIRABLE', expiryDate: daysFromNow(26), available: 30}));
			expect(result!.available).toBe(29);
			expect(notificationServiceMock.sendExpirationNotification).not.toHaveBeenCalled();
		});

		it('mettre en non dispo quand expiré', async () => {
			const expiryDate = daysFromNow(-2);
			const result = await processAndReload(createProduct({
				type: 'EXPIRABLE', expiryDate, available: 6, name: 'Milk',
			}));
			expect(result!.available).toBe(0);
			expect(notificationServiceMock.sendExpirationNotification).toHaveBeenCalledWith('Milk', expiryDate);
		});

		it('envoie de notification quand out of stock mais non expiré', async () => {
			const result = await processAndReload(createProduct({
				type: 'EXPIRABLE', expiryDate: daysFromNow(26), available: 0, name: 'Butter',
			}));
			expect(result!.available).toBe(0);
			expect(notificationServiceMock.sendExpirationNotification).toHaveBeenCalledWith('Butter', expect.any(Date));
		});
	});
});

