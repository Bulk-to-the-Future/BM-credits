export interface OrderLine {
  id: string;
  quantity: number;
  unitPrice?: {
    gross?: {
      amount: number;
    };
  };
  product?: {
    id: string;
    metadata?: { key: string; value: string }[];
  };
  variant?: {
    id: string;
    product?: {
      id: string;
      metadata?: { key: string; value: string }[];
    };
  };
  privateMetadata?: { key: string; value: string }[];
}

  
  export interface OrderData {
    order: {
      lines: OrderLine[];
    };
  }
  
  export interface FulfillmentLine {
    quantity: number;
    orderLine: { id: string };
  }
  
  export interface OrderDetailsData {
    order: {
      id: string;
      lines: {
        id: string;
        quantity: number;
        quantityFulfilled: number;
        variant: { id: string; product: { id: string } };
        privateMetadata: { key: string; value: string }[];
      }[];
    };
  }
  
  export interface Config {
    minQty: number;
    discountPercent: number;
    windowDays: number;
  }