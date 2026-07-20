"use client";

import { useParams } from "next/navigation";
import JoinForm from "@/components/join-form";

export default function JoinWithCodePage() {
  const params = useParams();
  return <JoinForm initialCode={params.code} />;
}
