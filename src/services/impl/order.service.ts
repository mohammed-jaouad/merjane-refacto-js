import {type Cradle} from '@fastify/awilix';
import {type OrderRepository} from '@/repos/order.repository.js';
import {type ProductService} from './product.service.js';

export class OrderService {
	private readonly orderRepository: OrderRepository;
	private readonly productService: ProductService;

	public constructor({orderRepository, ps}: Pick<Cradle, 'orderRepository' | 'ps'>) {
		this.orderRepository = orderRepository;
		this.productService = ps;
	}

	public async processOrder(orderId: number): Promise<number | undefined> {
		const order = (await this.orderRepository.findProducts(orderId))!;

        if(!order){
            return undefined;
        }

		for (const {product} of order.products) {
			await this.productService.processProduct(product); 
		}

		return order.id;
	}
}