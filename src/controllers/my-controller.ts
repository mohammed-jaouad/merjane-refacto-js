import fastifyPlugin from 'fastify-plugin';
import {serializerCompiler, validatorCompiler, type ZodTypeProvider} from 'fastify-type-provider-zod';
import {z} from 'zod';


export const myController = fastifyPlugin(async server => {
	// Add schema validator and serializer
	server.setValidatorCompiler(validatorCompiler);
	server.setSerializerCompiler(serializerCompiler);

	server.withTypeProvider<ZodTypeProvider>().post('/orders/:orderId/processOrder', {
		schema: {
			params: z.object({
				orderId: z.coerce.number(),
			}),
		},
	}, async (request, reply) => {
		const os = server.diContainer.resolve('os');
		const orderId = await os.processOrder(request.params.orderId);

		// retourner 404 si la commande est undefined (voir le service Order)
		if(orderId === undefined){
			await reply.code(404).send({message : "Commande pas trouvée !"})
		}

		// console.log(orderId);
		await reply.send({orderId: orderId});

	});
});

