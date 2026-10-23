import { orders } from "@/db/schema.js";
import { Database } from "@/db/type.js";
import { Cradle } from "@fastify/awilix";
import { eq } from "drizzle-orm";

export class OrderRepository{
    private readonly db: Database;

    public constructor({db} : Pick<Cradle, 'db'>){
        this.db = db;
    }

    public async findProducts( orderId : number){
        return this.db.query.orders.findFirst({
            where: eq(orders.id, orderId),
            with:{
                products : {
                    columns : {},
                    with: 
                        {
                            product: true
                        }
                }
            }
        })
    }
}