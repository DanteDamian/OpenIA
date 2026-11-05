import {expect,it} from "vitest";
import {memberInput} from "../src/features/users/validation";
const id="11111111-1111-4111-8111-111111111111";
it("valida vinculación confirmada por email y rol cerrado",()=>{
  expect(memberInput({email:" person@example.invalid ",role_id:"viewer"},false)).toEqual({email:"person@example.invalid",role_id:"viewer"});
  for(const role_id of ["owner","service_role",null,{}]) expect(memberInput({email:"person@example.invalid",role_id},false)).toBeNull();
});
it("rechaza asignación de empresa y campos administrativos",()=>{
  for(const field of ["organization_id","created_by","password","confirmed","constructor"])
    expect(memberInput({email:"person@example.invalid",role_id:"admin",[field]:"injected"},false)).toBeNull();
  expect(memberInput({email:"invalid",role_id:"admin"},false)).toBeNull();
});
it("exige identidad UUID y estado explícito en cambios",()=>{
  expect(memberInput({user_id:id,role_id:"manager",is_active:"false"},true)).toEqual({user_id:id,role_id:"manager",is_active:false});
  for(const is_active of [true,false,null,"falsey",{}]) expect(memberInput({user_id:id,role_id:"admin",is_active},true)).toBeNull();
  expect(memberInput({user_id:"bad",role_id:"admin",is_active:"true"},true)).toBeNull();
  expect(memberInput({},true)).toBeNull();
});
