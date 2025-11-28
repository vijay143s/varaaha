import type { NextFunction, Request, Response } from "express";
import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";

import { pool } from "../config/database.js";
import type {
  CreateProductInput,
  UpdateProductInput
} from "../schemas/product.schema.js";
import { slugify } from "../utils/slugify.js";

interface ProductRow extends RowDataPacket {
  id: number;
  slug: string;
  name: string;
  short_description: string | null;
  description: string | null;
  price: number;
  unit: string;
  is_active: number;
  created_at: Date;
  updated_at: Date;
}

interface ProductImageRow extends RowDataPacket {
  id: number;
  product_id: number;
  image_url: string;
  alt_text: string | null;
  is_primary: number;
  sort_order: number;
}

export async function listProducts(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const page = Number.parseInt((req.query.page as string) ?? "1", 10);
  const pageSize = Number.parseInt((req.query.pageSize as string) ?? "12", 10);
  const isActive = req.query.isActive;
  const search = (req.query.search as string)?.trim();

  const offset = (Math.max(page, 1) - 1) * Math.max(pageSize, 1);

  try {
    const params: Array<string | number> = [];
    const filters: string[] = [];

    if (isActive !== undefined) {
      filters.push("p.is_active = ?");
      params.push(isActive === "true" ? 1 : 0);
    }

    if (search) {
      filters.push("(p.name LIKE ? OR p.slug LIKE ?)");
      params.push(`%${search}%`, `%${search}%`);
    }

    const whereClause = filters.length > 0 ? `WHERE ${filters.join(" AND ")}` : "";

    const [rows] = await pool.query<ProductRow[]>(
      `SELECT p.id, p.slug, p.name, p.short_description, p.description, p.price, p.unit, p.is_active, p.created_at, p.updated_at
       FROM products p
       ${whereClause}
       ORDER BY p.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, pageSize, offset]
    );

    const [countRows] = await pool.query<RowDataPacket[]>(
      `SELECT COUNT(*) as total FROM products p ${whereClause}`,
      params
    );

    const productIds = rows.map((row) => row.id);
    let images: ProductImageRow[] = [];
    if (productIds.length > 0) {
      const [imageRows] = await pool.query<ProductImageRow[]>(
        `SELECT id, product_id, image_url, alt_text, is_primary, sort_order
         FROM product_images
         WHERE product_id IN (${productIds.map(() => "?").join(", ")})
         ORDER BY is_primary DESC, sort_order ASC, id ASC`,
        productIds
      );
      images = imageRows;
    }

    const imageMap = new Map<number, ProductImageRow[]>();
    for (const image of images) {
      const list = imageMap.get(image.product_id) ?? [];
      list.push(image);
      imageMap.set(image.product_id, list);
    }

    res.json({
      success: true,
      data: {
        items: rows.map((row) => ({
          id: row.id,
          slug: row.slug,
          name: row.name,
          shortDescription: row.short_description,
          description: row.description,
          price: Number(row.price),
          unit: row.unit,
          isActive: row.is_active === 1,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
          images: (imageMap.get(row.id) ?? []).map((img) => ({
            id: img.id,
            imageUrl: img.image_url,
            altText: img.alt_text,
            isPrimary: img.is_primary === 1,
            sortOrder: img.sort_order
          }))
        })),
        pagination: {
          page: Math.max(page, 1),
          pageSize: Math.max(pageSize, 1),
          total: Number(countRows[0]?.total ?? 0)
        }
      }
    });
  } catch (error) {
    next(error);
  }
}

export async function getProductBySlug(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const { slug } = req.params;

  try {
    const [rows] = await pool.query<ProductRow[]>(
      `SELECT id, slug, name, short_description, description, price, unit, is_active, created_at, updated_at
       FROM products
       WHERE slug = ?
       LIMIT 1`,
      [slug]
    );

    if (rows.length === 0) {
      res.status(404).json({ success: false, error: "Product not found" });
      return;
    }

    const product = rows[0];
    const [imageRows] = await pool.query<ProductImageRow[]>(
      `SELECT id, product_id, image_url, alt_text, is_primary, sort_order
       FROM product_images
       WHERE product_id = ?
       ORDER BY is_primary DESC, sort_order ASC, id ASC`,
      [product.id]
    );

    res.json({
      success: true,
      data: {
        id: product.id,
        slug: product.slug,
        name: product.name,
        shortDescription: product.short_description,
        description: product.description,
        price: Number(product.price),
        unit: product.unit,
        isActive: product.is_active === 1,
        createdAt: product.created_at,
        updatedAt: product.updated_at,
        images: imageRows.map((img) => ({
          id: img.id,
          imageUrl: img.image_url,
          altText: img.alt_text,
          isPrimary: img.is_primary === 1,
          sortOrder: img.sort_order
        }))
      }
    });
  } catch (error) {
    next(error);
  }
}

export async function createProduct(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const payload = req.body as CreateProductInput;

  const generatedSlug = slugify(payload.slug ?? payload.name);

  const connection = await pool.getConnection();
  await connection.beginTransaction();

  try {
    const [existing] = await connection.query<RowDataPacket[]>(
      "SELECT id FROM products WHERE slug = ? LIMIT 1",
      [generatedSlug]
    );

    if (existing.length > 0) {
      await connection.rollback();
      res.status(409).json({ success: false, error: "Slug already exists" });
      return;
    }

    const [result] = await connection.execute<ResultSetHeader>(
      `INSERT INTO products (slug, name, short_description, description, price, unit, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        generatedSlug,
        payload.name,
        payload.shortDescription ?? null,
        payload.description ?? null,
        payload.price,
        payload.unit ?? "liter",
        payload.isActive === false ? 0 : 1
      ]
    );

    const productId = result.insertId;

    if (payload.images && payload.images.length > 0) {
      const imageValues = payload.images.map((img, index) => [
        productId,
        img.imageUrl,
        img.altText ?? null,
        img.isPrimary ? 1 : 0,
        img.sortOrder ?? index
      ]);

      await connection.query(
        `INSERT INTO product_images (product_id, image_url, alt_text, is_primary, sort_order)
         VALUES ${imageValues.map(() => "(?, ?, ?, ?, ?)").join(", ")}`,
        imageValues.flat()
      );
    }

    await connection.commit();

    res.status(201).json({
      success: true,
      data: {
        id: productId,
        slug: generatedSlug
      }
    });
  } catch (error) {
    await connection.rollback();
    next(error);
  } finally {
    connection.release();
  }
}

export async function updateProduct(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const productId = Number.parseInt(req.params.id, 10);
  if (Number.isNaN(productId)) {
    res.status(400).json({ success: false, error: "Invalid product id" });
    return;
  }

  const payload = req.body as UpdateProductInput;

  const connection = await pool.getConnection();
  await connection.beginTransaction();

  try {
    const [existingRows] = await connection.query<ProductRow[]>(
      "SELECT id, slug FROM products WHERE id = ? LIMIT 1",
      [productId]
    );

    if (existingRows.length === 0) {
      await connection.rollback();
      res.status(404).json({ success: false, error: "Product not found" });
      return;
    }

    const current = existingRows[0];
    const newSlug = payload.slug ? slugify(payload.slug) : current.slug;

    if (newSlug !== current.slug) {
      const [slugCheck] = await connection.query<RowDataPacket[]>(
        "SELECT id FROM products WHERE slug = ? AND id <> ? LIMIT 1",
        [newSlug, productId]
      );
      if (slugCheck.length > 0) {
        await connection.rollback();
        res.status(409).json({ success: false, error: "Slug already exists" });
        return;
      }
    }

    const fields: string[] = [];
    const values: Array<string | number | null> = [];

    if (payload.name !== undefined) {
      fields.push("name = ?");
      values.push(payload.name);
    }

    if (payload.shortDescription !== undefined) {
      fields.push("short_description = ?");
      values.push(payload.shortDescription ?? null);
    }

    if (payload.description !== undefined) {
      fields.push("description = ?");
      values.push(payload.description ?? null);
    }

    if (payload.price !== undefined) {
      fields.push("price = ?");
      values.push(payload.price);
    }

    if (payload.unit !== undefined) {
      fields.push("unit = ?");
      values.push(payload.unit);
    }

    if (payload.isActive !== undefined) {
      fields.push("is_active = ?");
      values.push(payload.isActive ? 1 : 0);
    }

    if (newSlug !== current.slug) {
      fields.push("slug = ?");
      values.push(newSlug);
    }

    if (fields.length > 0) {
      await connection.execute(
        `UPDATE products SET ${fields.join(", ")} WHERE id = ?`,
        [...values, productId]
      );
    }

    if (payload.images !== undefined) {
      await connection.execute("DELETE FROM product_images WHERE product_id = ?", [productId]);

      if (payload.images.length > 0) {
        const imageValues = payload.images.map((img, index) => [
          productId,
          img.imageUrl,
          img.altText ?? null,
          img.isPrimary ? 1 : 0,
          img.sortOrder ?? index
        ]);

        await connection.query(
          `INSERT INTO product_images (product_id, image_url, alt_text, is_primary, sort_order)
           VALUES ${imageValues.map(() => "(?, ?, ?, ?, ?)").join(", ")}`,
          imageValues.flat()
        );
      }
    }

    await connection.commit();

    res.json({
      success: true,
      data: {
        id: productId,
        slug: newSlug
      }
    });
  } catch (error) {
    await connection.rollback();
    next(error);
  } finally {
    connection.release();
  }
}

export async function deleteProduct(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const productId = Number.parseInt(req.params.id, 10);
  if (Number.isNaN(productId)) {
    res.status(400).json({ success: false, error: "Invalid product id" });
    return;
  }

  try {
    const [result] = await pool.execute<ResultSetHeader>(
      "DELETE FROM products WHERE id = ?",
      [productId]
    );

    if (result.affectedRows === 0) {
      res.status(404).json({ success: false, error: "Product not found" });
      return;
    }

    res.status(204).send();
  } catch (error) {
    next(error);
  }
}
