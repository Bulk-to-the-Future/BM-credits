import { PropsWithChildren, useMemo } from "react";
import { ApolloProvider } from "@apollo/client";
import { useAppBridge } from "@saleor/app-sdk/app-bridge";
import { createClient } from "@/lib/client";

export function GraphQLProvider(props: PropsWithChildren<{}>) {
  const { appBridgeState } = useAppBridge();
  const url = appBridgeState?.saleorApiUrl;

  const client = useMemo(() => {
    if (!url || !appBridgeState?.token) return null;
    return createClient(url, appBridgeState.token);
  }, [url, appBridgeState?.token]);

  if (!client) {
    console.warn("Install the app in the Dashboard to query Saleor API.");
    return <>{props.children}</>;
  }

  return <ApolloProvider client={client}>{props.children}</ApolloProvider>;
}
