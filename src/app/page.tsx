import DashboardShell from "@/components/dashboard/DashboardShell";

export default function Home() {
  return (
    <DashboardShell
      isSimulated={process.env.NEXT_PUBLIC_USE_MOCKS === "true"}
    />
  );
}
