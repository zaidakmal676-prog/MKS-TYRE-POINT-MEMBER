import { store } from "../../lib/snap.mjs";
export default async()=>{await store()};
export const config={schedule:"@daily"};
