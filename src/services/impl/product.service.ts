import {type Cradle} from '@fastify/awilix';
import {type INotificationService} from '../notifications.port.js';
import {type Product} from '@/db/schema.js';
import { ProductRepository } from '@/repos/product.respository.js';

const DAYS = 1000 * 60 * 60 * 24; // Date

export class ProductService {
	private readonly ns: INotificationService;
	// private readonly db: Database;
	private readonly productRepository: ProductRepository;

	// public constructor({ns, db}: Pick<Cradle, 'ns' | 'db'>) {
	public constructor({ns, productRepository}: Pick<Cradle, 'ns' | 'productRepository'>) {
		this.ns = ns;
		// this.db = db;
		this.productRepository = productRepository;
	}

	public async processProduct(product: Product): Promise< void>{
		switch ( product.type ){
			case 'NORMAL':{
					await this.handleNormalProduct(product)
				break
			}
			case "SEASONAL":{
				await this.handleSeasonalProduct(product)
				break;
			}
			case "EXPIRABLE":{
				await this.handleExpiredProduct(product)
				break;
			}
		}
	}

	private async decrementStock( p: Product ): Promise<void>{
		p.available --;
		await this.productRepository.save(p)
	}

	private async setUnavailable(p: Product): Promise<void>{
		p.available = 0;
		await this.productRepository.save(p)
	}

	private notifyDelay(p: Product): void {
		this.ns.sendDelayNotification(p.leadTime, p.name);
	}

	private async handleNormalProduct(p: Product): Promise<void> {
		if (p.available > 0) await this.decrementStock(p)
		else if (p.leadTime > 0 ) this.notifyDelay(p)
	}

	private async handleSeasonalProduct(p: Product): Promise<void> {
		const currentDate = new Date();

		// si c'est dans la saison
		const inSeason = currentDate > p.seasonStartDate! && currentDate < p.seasonEndDate!;

		// produit dans la saison et dispo, on prend du stock
		if( inSeason && p.available > 0){
			await this.decrementStock(p);
			return;
		}

		// date reaprovisionement 
		const restockDate = new Date(currentDate.getTime() + p.leadTime * DAYS);
		// si la date de reaprovisionment arrive apres la fin de saison
		if( restockDate > p.seasonEndDate!){
			this.ns.sendOutOfStockNotification(p.name)
			await this.setUnavailable(p)
		}
		// si la saison n'a pas démarré
		else if ( p.seasonStartDate! > currentDate) {
			this.ns.sendOutOfStockNotification(p.name)
		}
		// pas dispo 
		else
		{
		
			this.notifyDelay(p)
		}
	}

	private async handleExpiredProduct(p: Product): Promise<void> {
		// simplifions si la date c'est now check si c'est expiré
		const isExpired = p.expiryDate! <= new Date();

		// si dispo et non expiré
		if( p.available > 0 && !isExpired)
			await this.decrementStock(p)
		else {
			this.ns.sendExpirationNotification(p.name, p.expiryDate!)
			await this.setUnavailable(p)
		}
	}
}
