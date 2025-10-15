import { gql } from "@apollo/client";
import { FETCH_APP_METADATA } from "./graphql/queries";

export async function getAppConfig(client: any, appId: string) {
  const { data } = await client.query({
    query: gql(FETCH_APP_METADATA),
    variables: { id: appId },
  });

  const metadata = data.app.privateMetadata.reduce((acc: any, m: any) => ({ ...acc, [m.key]: m.value }), {});

  return {
    minQty: parseInt(metadata.minQty || "10"),
    discountPercent: parseInt(metadata.discountPercent || "10"),
    windowDays: parseInt(metadata.windowDays || "14"),
  };
}