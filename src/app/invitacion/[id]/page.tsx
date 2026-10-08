import { notFound } from "next/navigation";
import { validUuid } from "@/lib/auth/validation";
import { InvitationForm } from "@/features/auth/invitation-form";
export const dynamic="force-dynamic";
export default async function InvitationPage({params}:{params:Promise<{id:string}>}) {
 const {id}=await params;if (!validUuid(id)) notFound();
 return <main id="contenido" className="flex min-h-screen items-center justify-center px-5 py-12"><section className="card w-full max-w-md p-8"><p className="eyebrow">AIGENTERRA FINANCE AI</p><h1 className="mt-3 text-2xl font-semibold">Activa tu acceso</h1><InvitationForm id={id}/></section></main>;
}
