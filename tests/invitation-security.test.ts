import {randomBytes} from "node:crypto";
import {expect,it,vi} from "vitest";
vi.mock("server-only",()=>({}));
import {sealInvitation,openInvitation,invitationTokens} from "../src/lib/auth/invitation-security";
import {sealRecovery,openRecovery} from "../src/lib/auth/recovery-security";
import {validAdminKey} from "../src/lib/supabase/admin";
const id="11111111-1111-4111-8111-111111111111";
it("separa invitaciones de recuperación con el mismo secreto",()=>{
 const secret=randomBytes(32).toString("hex");const grant={invitationId:id,accessToken:"a.b.c",refreshToken:"local-fixture",userId:id,expiresAt:Date.now()+60000};
 const sealed=sealInvitation(grant,secret);
 expect(openInvitation(sealed,secret)).toEqual(grant);
 expect(openRecovery(sealed,secret)).toBeNull();expect(openInvitation(sealRecovery(grant,secret),secret)).toBeNull();
 expect(openInvitation(sealed,randomBytes(32).toString("hex"))).toBeNull();
});
it("rechaza grants vencidos, alterados o sin invitación",()=>{
 const secret=randomBytes(32).toString("hex");const grant={invitationId:id,accessToken:"a.b.c",refreshToken:"local-fixture",userId:id,expiresAt:Date.now()-1};
 expect(openInvitation(sealInvitation(grant,secret),secret)).toBeNull();
 expect(openInvitation("forged",secret)).toBeNull();
 expect(openInvitation(sealInvitation({...grant,expiresAt:Date.now()+60000,invitationId:"bad"},secret),secret)).toBeNull();
});
it("valida tokens y rechaza redirect, roles y campos inesperados",()=>{
 const input={invitationId:id,accessToken:"a.b.c",refreshToken:"local-fixture"};
 expect(invitationTokens(input)).toEqual(input);
 for(const field of ["role_id","organization_id","next","email"]) expect(invitationTokens({...input,[field]:"injected"})).toBeNull();
 expect(invitationTokens({...input,accessToken:"a".repeat(5000)})).toBeNull();expect(invitationTokens({...input,refreshToken:""})).toBeNull();
});
it("una clave publicable o Management no habilita Auth Admin",()=>{
 expect(validAdminKey("sb_publishable_local-fixture-only")).toBe(false);
 expect(validAdminKey("sbp_local-fixture-only")).toBe(false);
 expect(validAdminKey(undefined)).toBe(false);
 expect(validAdminKey("sb_secret_local_fixture_key_123456789")).toBe(true);
 const encode=(role:string)=>`local.${Buffer.from(JSON.stringify({role})).toString("base64url")}.signature`;
 expect(validAdminKey(encode("anon"))).toBe(false);expect(validAdminKey(encode("service_role"))).toBe(true);
});
