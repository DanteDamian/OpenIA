import {getAccess} from "@/lib/auth/session";
import {sameOrigin} from "@/lib/auth/validation";
import {scanRadar} from "@/lib/radar/scan";
import {NextResponse} from "next/server";
export const maxDuration=60;
export async function POST(request:Request) {
 if(!sameOrigin(request))return NextResponse.json({error:"Origen no autorizado"},{status:403});
 const a=await getAccess();
 if(a.status!=="authorized" || !["admin","manager"].includes(a.role))return NextResponse.json({error:"No autorizado"},{status:403});
 return scanRadar(a.supabase,a.organizationId);
}
