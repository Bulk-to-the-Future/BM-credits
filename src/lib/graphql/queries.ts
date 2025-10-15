export const FETCH_ORDER = `
  query FetchOrder($id: ID!) {
    order(id: $id) {
      lines {
        id
        quantity
        unitPrice { gross { amount } }
        product { id }
        privateMetadata { key value }
      }
    }
  }
`;

export const ORDER_DETAILS_QUERY = `
  query OrderDetails($id: ID!) {
    order(id: $id) {
      id
      lines {
        id
        quantity
        quantityFulfilled
        variant {
          id
          product {
            id
          }
        }
        privateMetadata {
          key
          value
        }
      }
    }
  }
`;

export const UPDATE_LINE_DISCOUNT = `
  mutation OrderLineDiscountUpdate($lineId: ID!, $input: OrderDiscountCommonInput!) {
    orderLineDiscountUpdate(lineId: $lineId, input: $input) {
      orderLine { id }
      errors { field message }
    }
  }
`;

export const UPDATE_LINE_METADATA = `
  mutation UpdateLineMetadata($id: ID!, $input: [MetadataInput!]!) {
    updatePrivateMetadata(id: $id, input: $input) {
      item {
        ... on OrderLine {
          id
        }
      }
      errors {
        field
        message
      }
    }
  }
`;

export const FETCH_APP_METADATA = `
  query FetchAppMetadata($id: ID!) {
    app(id: $id) {
      privateMetadata {
        key
        value
      }
    }
  }
`;

export const UPDATE_APP_METADATA = `
  mutation UpdateAppMetadata($id: ID!, $input: [MetadataInput!]!) {
    updatePrivateMetadata(id: $id, input: $input) {
      item {
        privateMetadata {
          key
          value
        }
      }
      errors {
        field
        message
      }
    }
  }
`;

// FULFILL_ORDER not needed for app logic, but keep if testing
export const FULFILL_ORDER = `
  mutation FulfillOrder(
    $orderId: ID!
    $lines: [OrderFulfillLineInput!]!
    $notifyCustomer: Boolean
  ) {
    orderFulfill(
      order: $orderId
      input: {
        lines: $lines
        notifyCustomer: $notifyCustomer
        allowStockToBeExceeded: false
      }
    ) {
      order {
        id
        lines {
          id
          quantity
          quantityFulfilled
        }
      }
      fulfillments {
        id
        status
        lines {
          id
          quantity
        }
      }
      errors {
        field
        message
        code
      }
    }
  }
`;