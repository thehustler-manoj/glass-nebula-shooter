import { createFileRoute } from "@tanstack/react-router";
import Game from "@/components/Game";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  return <Game />;
}
