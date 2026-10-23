### Consignes JS:

- Si probleme de version pnpm, utiliser `corepack enable pnpm` qui devrait automatiquement utiliser la bonne version
- Ne pas modifier les classes qui ont un commentaire: `// WARN: Should not be changed during the exercise
`
- Pour lancer les tests: `pnpm test`
  - integration only in watch mode `pnpm test:integration`
  - unit only in watch mode `pnpm test:unit`


## refactoring 
### ARchitecture 
- 'controllers/' : HTTP uniquement 
- 'services/impl/order.service.ts' : Traite une commande produit par produit 
- 'services/impl/product.service.ts' : regles par type 
- 'repos/' : acces à la db

### Tests 
- 'product.service.spec.ts' : 10 tests unitaire rajouté couvrant tous les cas
- 'my-controller.integration.spec.ts' : verifie le stock et les notifications apres traitement 

### Remarques 
- une commande inexistante renvoie une erreur 500 : rajouté en 404