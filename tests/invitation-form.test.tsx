// @vitest-environment jsdom
import {afterEach,expect,it,vi} from "vitest";
import {StrictMode} from "react";
import {cleanup,fireEvent,render,screen,waitFor} from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
const refresh=vi.hoisted(()=>vi.fn());
vi.mock("next/navigation",()=>({useRouter:()=>({refresh})}));
import {InvitationForm} from "../src/features/auth/invitation-form";
import {MemberForm} from "../src/features/users/member-form";
const id="11111111-1111-4111-8111-111111111111";
afterEach(()=>{cleanup();vi.unstubAllGlobals();vi.clearAllMocks();window.history.replaceState(null,"","/");});
it("retira tokens y redirecciones de la URL antes de cualquier solicitud",async()=>{
 window.history.replaceState(null,"",`/invitacion/${id}?next=https://external.invalid#access_token=a.b.c&refresh_token=local-fixture&type=invite`);
 const fetch=vi.fn().mockResolvedValue({ok:true,json:async()=>({organization:"Empresa local"})});vi.stubGlobal("fetch",fetch);
 render(<StrictMode><InvitationForm id={id}/></StrictMode>);
 expect(window.location.hash).toBe("");expect(window.location.search).toBe("");expect(fetch).not.toHaveBeenCalled();
 fireEvent.click(screen.getByRole("button",{name:"Validar invitación"}));
 await waitFor(()=>expect(screen.getByText(/Tu correo ya fue verificado/)).toBeInTheDocument());
 expect(fetch.mock.calls[0][0]).toBe("/api/auth/invitations/verify");
 expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({accessToken:"a.b.c",refreshToken:"local-fixture",invitationId:id});
});
it("no envía peticiones para un enlace sin credenciales",()=>{
 const fetch=vi.fn();vi.stubGlobal("fetch",fetch);render(<InvitationForm id={id}/>);
 fireEvent.click(screen.getByRole("button",{name:"Validar invitación"}));
 expect(fetch).not.toHaveBeenCalled();expect(screen.getByRole("status")).toHaveTextContent("Enlace inválido");
});
it("invita por correo sin exigir una cuenta creada manualmente",async()=>{
 const fetch=vi.fn().mockResolvedValue({ok:true});vi.stubGlobal("fetch",fetch);
 render(<MemberForm/>);fireEvent.click(screen.getByRole("button",{name:"+ Nuevo usuario"}));
 fireEvent.change(screen.getByLabelText(/Correo del usuario/),{target:{value:"person@example.invalid"}});
 fireEvent.submit(screen.getByRole("form",{name:"Invitar usuario"}));
 await waitFor(()=>expect(screen.getByRole("status")).toHaveTextContent("Invitación enviada"));
 expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({email:"person@example.invalid",role_id:"viewer"});
});
it("muestra el fallo concreto del servidor sin perder el correo",async()=>{
 const fetch=vi.fn().mockResolvedValue({ok:false,status:502,json:async()=>({error:"No se pudo enviar el correo. Reenvía desde la lista."})});vi.stubGlobal("fetch",fetch);
 render(<MemberForm/>);fireEvent.click(screen.getByRole("button",{name:"+ Nuevo usuario"}));
 fireEvent.change(screen.getByLabelText(/Correo del usuario/),{target:{value:"person@example.invalid"}});
 fireEvent.submit(screen.getByRole("form",{name:"Invitar usuario"}));
 await waitFor(()=>expect(screen.getByRole("alert")).toHaveTextContent("No se pudo enviar el correo"));
 expect(screen.getByLabelText(/Correo del usuario/)).toHaveValue("person@example.invalid");
});
