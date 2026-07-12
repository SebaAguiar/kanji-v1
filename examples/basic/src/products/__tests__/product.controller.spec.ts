import { describe, it, expect, beforeEach } from 'bun:test';
import { Test } from '@kanjijs/testing';
import { ProductModule } from '../product.module.js';
import { ProductController } from '../product.controller.js';
import { ProductService } from '../product.service.js';
import { ProductRepository } from '../product.repository.js';
import { DATABASE_CLIENT } from '@kanjijs/store';
import { KanjijsModule } from '@kanjijs/core';

describe('ProductController', () => {
  let controller: ProductController;
  let service: ProductService;
  let repository: ProductRepository;

  beforeEach(async () => {
    const mockDb = {
      query: {
        products: {
          insert: async () => {},
          select: async () => [],
        },
      },
      collection: () => ({ 
        insertOne: async () => {},
        find: () => ({ toArray: async () => [] }),
        findOne: async () => null,
        updateOne: async () => {},
        deleteOne: async () => {},
      }),
    };

    @KanjijsModule({
      providers: [
        { provide: DATABASE_CLIENT, useValue: mockDb }
      ],
      exports: [DATABASE_CLIENT],
      global: true
    })
    class MockDatabaseModule {}

    const module = await Test.createTestingModule({
      imports: [MockDatabaseModule, ProductModule],
    }).compile();

    controller = module.get(ProductController);
    service = module.get(ProductService);
    repository = module.get(ProductRepository);
  });

  describe('POST /', () => {
    it('should create a product', async () => {
      expect(controller).toBeDefined();
      expect(service).toBeDefined();
      expect(repository).toBeDefined();
    });
  });

  describe('GET /', () => {
    it('should return all products', async () => {
      expect(controller).toBeDefined();
    });
  });

});
