import { Repository, Inject } from '@kanjijs/core';
import { DATABASE_CLIENT, type Database } from '@kanjijs/store';
import type { ProductResponse, CreateProductInput } from './product.contracts.js';

@Repository()
export class ProductRepository {
  constructor(
    @Inject(DATABASE_CLIENT)
    private readonly db: Database,
  ) {}

  async create(input: CreateProductInput): Promise<ProductResponse> {
    const id = Math.random().toString(36).substring(7);
    await this.db.query.products.insert({
      id,
      ...input,
    });
    return { id, ...input };
  }

  async findAll(): Promise<ProductResponse[]> {
    const results = await this.db.query.products.select();
    return results as any as ProductResponse[];
  }

  async findOne(id: string): Promise<ProductResponse | null> {
    const result = await this.db.query.products.select();
    const found = result.find((item: any) => item.id === id);
    return found ? (found as any as ProductResponse) : null;
  }

  async update(id: string, input: Partial<CreateProductInput>): Promise<ProductResponse> {
    await this.db.query.products.update(input);
    return { id, name: input.name ?? '' };
  }

  async delete(_id: string): Promise<{ success: boolean }> {
    await this.db.query.products.delete();
    return { success: true };
  }
}
