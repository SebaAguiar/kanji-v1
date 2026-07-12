import { Injectable } from '@kanjijs/core';
import { ProductRepository } from './product.repository.js';
import type { ProductResponse, CreateProductInput } from './product.contracts.js';

@Injectable()
export class ProductService {
  constructor(private readonly repository: ProductRepository) {}

  async create(input: CreateProductInput): Promise<ProductResponse> {
    return this.repository.create(input);
  }

  async findAll(): Promise<ProductResponse[]> {
    return this.repository.findAll();
  }

  async findOne(id: string): Promise<ProductResponse | null> {
    return this.repository.findOne(id);
  }

  async update(id: string, input: Partial<CreateProductInput>): Promise<ProductResponse> {
    return this.repository.update(id, input);
  }

  async delete(id: string): Promise<{ success: boolean }> {
    return this.repository.delete(id);
  }

}
