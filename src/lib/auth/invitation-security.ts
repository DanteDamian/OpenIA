import { createHash } from "node:crypto";
import { openRecovery,sealRecovery,type RecoveryGrant } from "./recovery-security";
import { validUuid } from "./validation";
export const invitationCookie="aigenterra-invitation";
export type InvitationGrant=RecoveryGrant & {invitationId:string};
function key(secret:string) {
 if (!/^[a-fA-F0-9]{64}$/.test(secret)) throw new Error("Invalid secret");
 return createHash("sha256").update("aigenterra-invitation-v1:"+secret).digest("hex");
}
export function sealInvitation(grant:InvitationGrant,secret:string) {return sealRecovery(grant,key(secret));}
export function openInvitation(value:string|undefined,secret:string) {
 try {const grant=openRecovery(value,key(secret)) as InvitationGrant|null;return grant && validUuid(grant.invitationId) ? grant : null;} catch {return null;}
}
export function invitationTokens(raw:unknown) {
 if (!raw || typeof raw!=="object" || Array.isArray(raw)) return null;
 const input=raw as Record<string,unknown>;
 if (Object.keys(input).sort().join(",")!=="accessToken,invitationId,refreshToken" || !validUuid(input.invitationId)
  || typeof input.accessToken!=="string" || input.accessToken.length>4096 || !/^[\w-]+\.[\w-]+\.[\w-]+$/.test(input.accessToken)
  || typeof input.refreshToken!=="string" || !/^[\w-]{10,1024}$/.test(input.refreshToken)) return null;
 return input as {invitationId:string;accessToken:string;refreshToken:string};
}
