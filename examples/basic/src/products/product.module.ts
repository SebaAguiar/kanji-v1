import { KanjijsModule } from '@kanjijs/core';
import { ProductController } from './product.controller.js';
import { ProductService } from './product.service.js';
import { ProductRepository } from './product.repository.js';
import { ProductPolicy } from './product.policy';

@KanjijsModule({
  controllers: [ProductController],
  repositories: [ProductRepository],
  providers: [ProductService, ProductPolicy],
  exports: [ProductService, ProductPolicy],
})
export class ProductModule {}
