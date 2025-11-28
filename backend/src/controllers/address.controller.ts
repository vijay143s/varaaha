import type { NextFunction, Request, Response } from "express";
import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";

import { pool } from "../config/database.js";
import type { AddressInput } from "../schemas/address.schema.js";

interface AddressRow extends RowDataPacket {
  id: number;
  user_id: number | null;
  full_name: string;
  phone: string | null;
  address_line1: string;
  address_line2: string | null;
  city: string;
  state: string;
  postal_code: string;
  country: string;
  is_default: number;
  created_at: Date;
  updated_at: Date;
}

export async function listAddresses(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  if (!req.user) {
    res.status(401).json({ success: false, error: "Unauthorized" });
    return;
  }

  try {
    const [rows] = await pool.query<AddressRow[]>(
      `SELECT id, full_name, phone, address_line1, address_line2, city, state, postal_code, country, is_default
       FROM addresses
       WHERE user_id = ?
       ORDER BY is_default DESC, updated_at DESC`,
      [Number.parseInt(req.user.sub, 10)]
    );

    res.json({
      success: true,
      data: rows.map((row) => ({
        id: row.id,
        fullName: row.full_name,
        phone: row.phone,
        addressLine1: row.address_line1,
        addressLine2: row.address_line2,
        city: row.city,
        state: row.state,
        postalCode: row.postal_code,
        country: row.country,
        isDefault: row.is_default === 1
      }))
    });
  } catch (error) {
    next(error);
  }
}

export async function createAddress(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  if (!req.user) {
    res.status(401).json({ success: false, error: "Unauthorized" });
    return;
  }

  const payload = req.body as AddressInput;

  try {
    if (payload.isDefault) {
      await pool.execute(
        `UPDATE addresses SET is_default = 0 WHERE user_id = ?`,
        [Number.parseInt(req.user.sub, 10)]
      );
    }

    const [result] = await pool.execute<ResultSetHeader>(
      `INSERT INTO addresses (user_id, full_name, phone, address_line1, address_line2, city, state, postal_code, country, is_default)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        Number.parseInt(req.user.sub, 10),
        payload.fullName,
        payload.phone,
        payload.addressLine1,
        payload.addressLine2 ?? null,
        payload.city,
        payload.state,
        payload.postalCode,
        payload.country ?? "India",
        payload.isDefault ? 1 : 0
      ]
    );

    res.status(201).json({
      success: true,
      data: {
        id: result.insertId
      }
    });
  } catch (error) {
    next(error);
  }
}

export async function updateAddress(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  if (!req.user) {
    res.status(401).json({ success: false, error: "Unauthorized" });
    return;
  }

  const addressId = Number.parseInt(req.params.id, 10);
  if (Number.isNaN(addressId)) {
    res.status(400).json({ success: false, error: "Invalid address id" });
    return;
  }

  const payload = req.body as AddressInput;

  try {
    const [existing] = await pool.query<AddressRow[]>(
      `SELECT id FROM addresses WHERE id = ? AND user_id = ? LIMIT 1`,
      [addressId, Number.parseInt(req.user.sub, 10)]
    );

    if (existing.length === 0) {
      res.status(404).json({ success: false, error: "Address not found" });
      return;
    }

    if (payload.isDefault) {
      await pool.execute(
        `UPDATE addresses SET is_default = 0 WHERE user_id = ?`,
        [Number.parseInt(req.user.sub, 10)]
      );
    }

    await pool.execute(
      `UPDATE addresses
       SET full_name = ?, phone = ?, address_line1 = ?, address_line2 = ?, city = ?, state = ?, postal_code = ?, country = ?, is_default = ?
       WHERE id = ? AND user_id = ?`,
      [
        payload.fullName,
        payload.phone,
        payload.addressLine1,
        payload.addressLine2 ?? null,
        payload.city,
        payload.state,
        payload.postalCode,
        payload.country ?? "India",
        payload.isDefault ? 1 : 0,
        addressId,
        Number.parseInt(req.user.sub, 10)
      ]
    );

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
}

export async function deleteAddress(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  if (!req.user) {
    res.status(401).json({ success: false, error: "Unauthorized" });
    return;
  }

  const addressId = Number.parseInt(req.params.id, 10);
  if (Number.isNaN(addressId)) {
    res.status(400).json({ success: false, error: "Invalid address id" });
    return;
  }

  try {
    const [result] = await pool.execute<ResultSetHeader>(
      `DELETE FROM addresses WHERE id = ? AND user_id = ?`,
      [addressId, Number.parseInt(req.user.sub, 10)]
    );

    if (result.affectedRows === 0) {
      res.status(404).json({ success: false, error: "Address not found" });
      return;
    }

    res.status(204).send();
  } catch (error) {
    next(error);
  }
}
