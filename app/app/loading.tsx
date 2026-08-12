import { DataStatePanel } from "@/components/ops/views";

export default function OperatorLoading() {
  return <DataStatePanel state={{ kind: "loading", label: "Loading operator workspace" }} />;
}
