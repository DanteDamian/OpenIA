"use client";
import { RecordForm } from "@/features/clients/record-form";
import { roleOptions } from "./validation";
export function MemberForm({member}:{member?:{user_id:string;role_id:string;is_active:boolean;email:string}}) {
  return <RecordForm title={member ? `Editar acceso de ${member.email}` : "Invitar usuario"}
    triggerLabel={member ? "Editar acceso" : "+ Nuevo usuario"} endpoint="/api/users" method={member ? "PATCH" : "POST"}
    showServerError successMessage={member ? "Acceso organizacional actualizado." : "Invitación enviada. La persona debe abrir el correo para activar su acceso."} help={member ? "Suspender bloquea los datos de esta empresa. No elimina la cuenta ni sus registros. Debe quedar un administrador activo." : "Indica el correo y el rol. Enviaremos un enlace para verificar el correo y establecer la contraseña. El acceso se activa al aceptar la invitación."}
    fields={[
      ...(member ? [{name:"user_id",label:"Identificador del usuario",required:true,max:36,initial:member.user_id,readOnly:true}] : [{name:"email",label:"Correo del usuario",required:true,max:254,type:"email" as const}]),
      {name:"role_id",label:"Rol",required:true,max:20,options:roleOptions,initial:member?.role_id || "viewer"},
      ...(member ? [{name:"is_active",label:"Acceso a esta empresa",required:true,max:5,options:[{value:"true",label:"Activo"},{value:"false",label:"Suspendido"}],initial:String(member.is_active)}] : []),
    ]} />;
}
