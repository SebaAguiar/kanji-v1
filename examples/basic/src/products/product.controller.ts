import { Controller, Post, Get, Patch, Delete } from '@kanjijs/platform-hono';
import { Contract } from '@kanjijs/contracts';
import { type Context } from 'hono';
import { ProductService } from './product.service.js';
import { ProductContracts } from './product.contracts.js';

@Controller('/products')
export class ProductController {
  constructor(private readonly productService: ProductService) {}

  @Post('/')
  @Contract(ProductContracts.create)
  async create(c: Context): Promise<Response> {
    const input = c.get('kanji.validated.body');
    const result = await this.productService.create(input);
    return c.json(result, 201);
  }

  @Get('/')
  @Contract(ProductContracts.findAll)
  async findAll(c: Context): Promise<Response> {
    const result = await this.productService.findAll();
    return c.json(result, 200);
  }

  @Get('/:id')
  @Contract(ProductContracts.findOne)
  async findOne(c: Context): Promise<Response> {
    const id = c.req.param('id');
    const result = await this.productService.findOne(id);
    if (!result) return c.json({ error: 'Not found' }, 404);
    return c.json(result, 200);
  }

  @Patch('/:id')
  @Contract(ProductContracts.update)
  async update(c: Context): Promise<Response> {
    const id = c.req.param('id');
    const input = c.get('kanji.validated.body');
    const result = await this.productService.update(id, input);
    return c.json(result, 200);
  }

  @Delete('/:id')
  @Contract(ProductContracts.delete)
  async delete(c: Context): Promise<Response> {
    const id = c.req.param('id');
    const result = await this.productService.delete(id);
    return c.json(result, 200);
  }

}
