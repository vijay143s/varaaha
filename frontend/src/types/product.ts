export interface ProductImage {
  id: number;
  imageUrl: string;
  altText: string | null;
  isPrimary: boolean;
  sortOrder: number;
}

export interface Product {
  id: number;
  slug: string;
  name: string;
  shortDescription: string | null;
  description?: string | null;
  price: number;
  unit: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  images: ProductImage[];
}
