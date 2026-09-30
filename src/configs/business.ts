import customer from "../../customer.generated.json";

export const business = {
  name: customer.brand_name,
  legalName: customer.identity.legal_name,
  domain: customer.primary_domain,
} as const;
