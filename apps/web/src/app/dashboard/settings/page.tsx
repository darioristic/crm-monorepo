import type { Metadata } from "next";
import SettingsClient from "./client";

export const metadata: Metadata = {
  title: "Team Settings",
};

export default async function SettingsPage() {
  return <SettingsClient />;
}
