import { ApolloClient, InMemoryCache, HttpLink } from "@apollo/client";

export function createClient(saleorApiUrl: string, token: string) {
  return new ApolloClient({
    link: new HttpLink({
      uri: saleorApiUrl,
      headers: { Authorization: `Bearer ${token}` },
    }),
    cache: new InMemoryCache(),
  });
}