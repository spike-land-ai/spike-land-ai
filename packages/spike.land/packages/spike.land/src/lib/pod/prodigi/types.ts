/**
 * Prodigi API types.
 * Based on Prodigi API documentation: https://www.prodigi.com/print-api/docs/
 */

// Order Creation Request
export interface ProdigiOrderRequest {
  merchantReference: string;
  shippingMethod: "Budget" | "Standard" | "Express";
  recipient: ProdigiRecipient;
  items: ProdigiOrderItem[];
  metadata?: Record<string, string>;
}

interface ProdigiRecipient {
  name: string;
  address: ProdigiAddress;
  email?: string;
  phoneNumber?: string;
}

interface ProdigiAddress {
  line1: string;
  line2?: string;
  postalOrZipCode: string;
  countryCode: string; // ISO 3166-1 alpha-2
  townOrCity: string;
  stateOrCounty?: string;
}

interface ProdigiOrderItem {
  sku: string;
  copies: number;
  sizing: "fillPrintArea" | "fitPrintArea" | "stretchToPrintArea";
  assets: ProdigiAsset[];
  attributes?: Record<string, string>;
}

interface ProdigiAsset {
  printArea: "default" | string;
  url: string;
}

// Order Creation Response
export interface ProdigiOrderResponse {
  outcome: "Created" | "CreatedWithIssues" | "AlreadyExists";
  order: ProdigiOrder;
}

interface ProdigiOrder {
  id: string;
  created: string;
  lastUpdated: string;
  callbackUrl?: string;
  merchantReference: string;
  shippingMethod: string;
  idempotencyKey?: string;
  status: ProdigiOrderStatus;
  charges: ProdigiCharge[];
  shipments: ProdigiShipment[];
  recipient: ProdigiRecipient;
  items: ProdigiOrderItemResponse[];
  packingSlip?: ProdigiPackingSlip;
  metadata?: Record<string, string>;
}

interface ProdigiOrderStatus {
  stage:
    | "InProgress"
    | "Complete"
    | "Cancelled";
  issues?: ProdigiIssue[];
  details: ProdigiStatusDetails;
}

interface ProdigiStatusDetails {
  downloadAssets:
    | "NotStarted"
    | "InProgress"
    | "Complete"
    | "Error";
  printReadyAssetsPrepared:
    | "NotStarted"
    | "InProgress"
    | "Complete"
    | "Error";
  allocateProductionLocation:
    | "NotStarted"
    | "InProgress"
    | "Complete"
    | "Error";
  inProduction:
    | "NotStarted"
    | "InProgress"
    | "Complete"
    | "Error";
  shipping:
    | "NotStarted"
    | "InProgress"
    | "Complete"
    | "Error";
}

interface ProdigiIssue {
  objectId: string;
  errorCode: string;
  description: string;
  authorisationDetails?: {
    authorisationUrl: string;
  };
}

interface ProdigiCharge {
  id: string;
  prodigiInvoiceNumber?: string;
  totalCost: ProdigiMoney;
  totalTax?: ProdigiMoney;
  items: ProdigiChargeItem[];
}

interface ProdigiChargeItem {
  id: string;
  itemId?: string;
  cost: ProdigiMoney;
  description: string;
  shipmentId?: string;
}

interface ProdigiMoney {
  amount: string; // Decimal string
  currency: string;
}

interface ProdigiShipment {
  id: string;
  status: "NotYetShipped" | "Shipped" | "InTransit" | "Delivered";
  carrier?: ProdigiCarrier;
  tracking?: ProdigiTracking;
  dispatchDate?: string;
  items: { itemId: string; }[];
}

interface ProdigiCarrier {
  name: string;
  service?: string;
}

interface ProdigiTracking {
  number?: string;
  url?: string;
}

interface ProdigiOrderItemResponse {
  id: string;
  status: "NotYetDownloaded" | "Ok" | "Error";
  sku: string;
  copies: number;
  sizing: string;
  assets: ProdigiAssetResponse[];
  recipientCost?: ProdigiMoney;
  attributes?: Record<string, string>;
}

interface ProdigiAssetResponse {
  id: string;
  printArea: string;
  status: "InProgress" | "Complete" | "Error";
  url: string;
  md5Hash?: string;
  thumbnailUrl?: string;
}

interface ProdigiPackingSlip {
  url?: string;
  status?: string;
}

// Quote Request/Response
export interface ProdigiQuoteRequest {
  shippingMethod: "Budget" | "Standard" | "Express";
  destinationCountryCode: string;
  currencyCode: string;
  items: ProdigiQuoteItem[];
}

interface ProdigiQuoteItem {
  sku: string;
  copies: number;
  attributes?: Record<string, string>;
}

export interface ProdigiQuoteResponse {
  quotes: ProdigiQuote[];
}

interface ProdigiQuote {
  shipmentMethod: string;
  costSummary: {
    items: ProdigiMoney;
    shipping: ProdigiMoney;
    totalCost: ProdigiMoney;
  };
  shipments: ProdigiQuoteShipment[];
  items: ProdigiQuoteItemResponse[];
}

interface ProdigiQuoteShipment {
  carrier: ProdigiCarrier;
  fulfillmentLocation: {
    countryCode: string;
    labCode: string;
  };
  cost: ProdigiMoney;
  items: ProdigiQuoteShipmentItem[];
}

interface ProdigiQuoteShipmentItem {
  sku: string;
  itemIndices: number[];
}

interface ProdigiQuoteItemResponse {
  sku: string;
  copies: number;
  unitCost: ProdigiMoney;
  totalCost: ProdigiMoney;
}

// Error Response
export interface ProdigiErrorResponse {
  statusCode: number;
  traceParent?: string;
  errors?: {
    property: string;
    description: string;
  }[];
}

// Order Status Response (GET /orders/{id})
export interface ProdigiOrderStatusResponse {
  outcome: "Ok" | "NotFound";
  order?: ProdigiOrder;
}

// Order Actions
export interface ProdigiCancelResponse {
  outcome: "Cancelled" | "NotCancellable" | "NotFound";
  order?: ProdigiOrder;
}
