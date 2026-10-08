import { requireAccess } from "@/lib/auth/session";
import { MemberForm } from "@/features/users/member-form";
import { roleOptions } from "@/features/users/validation";
export default async function UsersPage() {
  const access=await requireAccess();
  if (access.role!=="admin") return <section className="card p-6"><h1 className="text-2xl font-semibold">Usuarios</h1><p role="alert" className="mt-4">Esta sección está disponible únicamente para administradores.</p></section>;
  const {data,error}=await access.supabase.rpc("manage_organization_members",{target_organization:access.organizationId});
  const members=(data || []) as {user_id:string;display_name:string|null;email:string;role_id:string;is_active:boolean}[];
  return <><p className="eyebrow">ADMINISTRACIÓN</p><h1 className="mt-2 text-3xl font-semibold">Usuarios y permisos</h1>
    <p className="mt-3 text-slate-500">Gestiona el acceso a tu empresa. Los cambios quedan auditados y no eliminan información.</p>
    {error ? <p role="alert" className="card mt-6 p-6">No fue posible consultar los usuarios. Verifica que la migración de gestión de usuarios esté instalada.</p> : <>
      <MemberForm />
      <div className="mt-6 grid gap-4">{members.map(member=><article className="card p-6" key={member.user_id}><h2 className="break-words font-semibold">{member.display_name || member.email}</h2><p className="mt-2 break-words text-sm">{member.email}</p><p className="mt-2 text-sm">{roleOptions.find(role=>role.value===member.role_id)?.label} · {member.is_active ? "Activo" : "Suspendido"}{member.user_id===access.userId ? " · Tu cuenta" : ""}</p><MemberForm member={member}/></article>)}</div>
      {!members.length && <p className="mt-6">No hay membresías disponibles.</p>}
    </>}
    <section className="card mt-6 p-6"><h2 className="font-semibold">Cuentas nuevas e invitaciones</h2><p className="mt-3 text-sm">El envío de invitaciones requiere un flujo adicional de Supabase Auth. Esta versión administra cuentas existentes y confirmadas; no crea identidades ni cambia contraseñas.</p></section>
  </>;
}
