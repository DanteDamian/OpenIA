import { BusinessPage } from "@/features/business/business-page";
export default async function Detail({params}: {params:Promise<{module:string;id:string}>}) {
  const {module,id}=await params; return <BusinessPage resource={module} id={id} />;
}
