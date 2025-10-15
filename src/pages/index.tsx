import { useAppBridge } from "@saleor/app-sdk/app-bridge";
import { Box, Button, Input, Text } from "@saleor/macaw-ui";
import { NextPage } from "next";
import { useEffect, useState, ChangeEvent } from "react";
import { useQuery, useMutation } from "@apollo/client";
import { gql } from "@apollo/client";
import { FETCH_APP_METADATA, UPDATE_APP_METADATA } from "../lib/graphql/queries";

interface Config {
  minQty: number;
  discountPercent: number;
  windowDays: number;
}

const ConfigurationPage: NextPage = () => {
  const { appBridgeState } = useAppBridge();
  const [config, setConfig] = useState<Config>({
    minQty: 10,
    discountPercent: 10,
    windowDays: 14,
  });

  const { data, loading } = useQuery(gql(FETCH_APP_METADATA), {
    variables: { id: appBridgeState?.id },
    skip: !appBridgeState?.ready,
  });

  const [updateMetadata] = useMutation(gql(UPDATE_APP_METADATA));

  useEffect(() => {
    if (data?.app?.privateMetadata) {
      const metadata = data.app.privateMetadata.reduce(
        (acc: any, m: any) => ({ ...acc, [m.key]: parseInt(m.value) || undefined }),
        {}
      );
      setConfig({
        minQty: metadata.minQty || 10,
        discountPercent: metadata.discountPercent || 10,
        windowDays: metadata.windowDays || 14,
      });
    }
  }, [data]);

  const handleSave = async () => {
    await updateMetadata({
      variables: {
        id: appBridgeState?.id,
        input: [
          { key: "minQty", value: config.minQty.toString() },
          { key: "discountPercent", value: config.discountPercent.toString() },
          { key: "windowDays", value: config.windowDays.toString() },
        ],
      },
    });
  };

  if (loading) return <Text>Loading...</Text>;

  if (!appBridgeState?.ready) {
    return (
      <Box>
        <Text>Install the app in your Saleor Dashboard to configure.</Text>
      </Box>
    );
  }

  return (
    <Box padding={8}>
      <Text as="h1" size={6}>BulkMagic Credits Configuration</Text>
      <Input
        label="Minimum Quantity for Bulk Discount"
        type="number"
        value={config.minQty}
        onChange={(e: ChangeEvent<HTMLInputElement>) => setConfig({ ...config, minQty: parseInt(e.target.value) || 10 })}
      />
      <Input
        label="Discount Percent (max 10%)"
        type="number"
        value={config.discountPercent}
        onChange={(e: ChangeEvent<HTMLInputElement>) => setConfig({ ...config, discountPercent: parseInt(e.target.value) || 10 })}
      />
      <Input
        label="Redemption Window (days)"
        type="number"
        value={config.windowDays}
        onChange={(e: ChangeEvent<HTMLInputElement>) => setConfig({ ...config, windowDays: parseInt(e.target.value) || 14 })}
      />
      <Button onClick={handleSave}>Save Configuration</Button>
    </Box>
  );
};

export default ConfigurationPage;