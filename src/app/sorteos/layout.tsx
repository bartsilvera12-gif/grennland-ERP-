import SorteosModuleGuard from "@/components/sorteos/SorteosModuleGuard";

export default function SorteosLayout({ children }: { children: React.ReactNode }) {
  return <SorteosModuleGuard>{children}</SorteosModuleGuard>;
}
