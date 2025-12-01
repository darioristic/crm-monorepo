"use client";

import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

type ProductEditContextType = {
  editProductId: string | null;
  openProductEdit: (productId: string) => void;
  closeProductEdit: () => void;
  onProductUpdated?: () => void;
  setOnProductUpdated: (callback: (() => void) | undefined) => void;
};

const ProductEditContext = createContext<ProductEditContextType | null>(null);

export function ProductEditProvider({ children }: { children: ReactNode }) {
  const [editProductId, setEditProductId] = useState<string | null>(null);
  const [onProductUpdated, setOnProductUpdatedState] = useState<(() => void) | undefined>();

  const openProductEdit = useCallback((productId: string) => {
    setEditProductId(productId);
  }, []);

  const closeProductEdit = useCallback(() => {
    setEditProductId(null);
  }, []);

  const setOnProductUpdated = useCallback((callback: (() => void) | undefined) => {
    setOnProductUpdatedState(() => callback);
  }, []);

  return (
    <ProductEditContext.Provider
      value={{
        editProductId,
        openProductEdit,
        closeProductEdit,
        onProductUpdated,
        setOnProductUpdated,
      }}
    >
      {children}
    </ProductEditContext.Provider>
  );
}

export function useProductEdit() {
  const context = useContext(ProductEditContext);
  if (!context) {
    throw new Error("useProductEdit must be used within ProductEditProvider");
  }
  return context;
}

