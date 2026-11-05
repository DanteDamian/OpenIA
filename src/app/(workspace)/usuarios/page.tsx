import { requireAccess } from "@/lib/auth/session";
import { MemberForm } from "@/features/users/member-form";
import { InvitationActions } from "@/features/users/invitation-actions";
import { adminConfiguration } from "@/lib/supabase/admin";
import { roleOptions } from "@/features/users/validation";
export default async function UsersPage() {
  const access=await requireAccess();
  if (access.role!=="admin") return <section className="card p-6"><h1 className="text-2xl font-semibold">Usuarios</h1><p role="alert" className="mt-4">Esta sección está disponible únicamente para administradores.</p></section>;
  const {data,error}=await access.supabase.rpc("manage_organization_members",{target_organization:access.organizationId});
  const invitations=await access.supabase.rpc("list_organization_invitations",{target_organization:access.organizationId});
  const canInvite=!!adminConfiguration();
  const members=(data || []) as {user_id:string;display_name:string|null;email:string;role_id:string;is_active:boolean}[];
  return <><p className="eyebrow">ADMINISTRACIÓN</p><h1 className="mt-2 text-3xl font-semibold">Usuarios y permisos</h1>
    <p className="mt-3 text-slate-500">Gestiona el acceso a tu empresa. Los cambios quedan auditados y no eliminan información.</p>
    {error ? <p role="alert" className="card mt-6 p-6">No fue posible consultar los usuarios. Intenta nuevamente o contacta al soporte.</p> : <>
      {canInvite ? <MemberForm /> : <p role="alert" className="card mt-6 p-6">El envío de invitaciones no está habilitado todavía. Contacta al responsable de la aplicación para habilitarlo.</p>}
      <div className="mt-6 grid gap-4">{members.map(member=><article className="card p-6" key={member.user_id}><h2 className="break-words font-semibold">{member.display_name || member.email}</h2><p className="mt-2 break-words text-sm">{member.email}</p><p className="mt-2 text-sm">{roleOptions.find(role=>role.value===member.role_id)?.label} · {member.is_active ? "Activo" : "Suspendido"}{member.user_id===access.userId ? " · Tu cuenta" : ""}</p><MemberForm member={member}/></article>)}</div>
      {!members.length && <p className="mt-6">No hay membresías disponibles.</p>}
    </>}
    <section className="mt-8"><h2 className="text-xl font-semibold">Invitaciones</h2>
      {invitations.error ? <p role="alert" className="card mt-4 p-6">No fue posible consultar las invitaciones. Intenta nuevamente o contacta al soporte.</p> : !invitations.data?.length ? <p className="card mt-4 p-6 text-sm text-slate-500">Todavía no has enviado invitaciones.</p> : <div className="mt-4 grid gap-4">{invitations.data.map((invitation:{id:string;email:string;role_id:string;status:string;expires_at:string})=><article key={invitation.id} className="card p-6"><h3 className="break-words font-semibold">{invitation.email}</h3><p className="mt-2 text-sm">{roleOptions.find(role=>role.value===invitation.role_id)?.label} · {({expired:"Vencida",sending:"Procesando envío",pending:"Esperando aceptación",failed:"Fallo de envío",accepted:"Aceptada",cancelled:"Cancelada"} as Record<string,string>)[invitation.status]}</p>{["sending","pending","failed","expired"].includes(invitation.status) && <InvitationActions id={invitation.id}/>}</article>)}</div>}
    </section>
  </>;
}
