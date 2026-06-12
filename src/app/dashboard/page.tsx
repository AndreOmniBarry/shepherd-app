'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell
} from 'recharts';

type KPI = { total_members:number; active_members:number; today_present:number; today_cells_reported:number; today_cells_total:number; ytd_giving_ngn:number; active_cells:number; new_members_month:number; };
type ChatMessage = { role:'user'|'agent'; text:string; agent?:string; loading?:boolean; };
type AgentName = 'ktava'|'arkwind'|'moshe'|'numbers';
type NavPage = 'dashboard'|'attendance'|'giving'|'members'|'cells'|'departments'|'reports';
type TimeRange = '8w'|'3m'|'6m'|'1y'|'2y'|'5y';

// ── Unique cell data with realistic, differentiated trends ─────
const CELLS_DATA = [
  // Youth - 12 cells (indices 0-11)
  {cell:'Glory House Cell',fel:'Youth',leader:'Bro. Emeka Okafor',members:22,avg:18,rate:82,trend:'+18%',status:'rising',
   history:[14,15,16,17,18,19,20,21,22,22,23,22],members_list:['Bro. Emeka Okafor','Sis. Chidinma Eze','Bro. Uche Nwosu','Sis. Ada Okafor','Bro. Tobi Akin','Sis. Yetunde Bello','Bro. Dare Ogun','Sis. Kemi Ojo','Bro. Sola Adex','Sis. Nike Labi','Bro. Gbenga Fash','Sis. Bisi Cole','Bro. Tayo Adey','Sis. Lola Babs','Bro. Wale Okon','Sis. Funke Ade','Bro. Seun Ayo','Sis. Toyin Olu']},
  {cell:'Zion Cell',fel:'Youth',leader:'Sis. Chioma Uzoma',members:14,avg:15,rate:78,trend:'+7%',status:'stable',
   history:[11,12,12,13,13,14,14,14,15,15,16,15],members_list:['Sis. Chioma Uzoma','Bro. Ifeanyi Obi','Sis. Ngozi Eze','Bro. Chukwu Nwa','Sis. Amaka Obi','Bro. Obiora Eze','Sis. Nneka Nwa','Bro. Emeka Okon','Sis. Adaeze Enu','Bro. Chidi Ogu','Sis. Ifeoma Ada','Bro. Kene Ike','Sis. Uju Onw','Bro. Oge Nna']},
  {cell:'Achievers Cell',fel:'Youth',leader:'Bro. Kelvin Nnamdi',members:16,avg:17,rate:76,trend:'+6%',status:'stable',
   history:[13,13,14,14,15,15,16,16,17,17,18,17],members_list:['Bro. Kelvin Nnamdi','Sis. Precious Obi','Bro. Victor Eze','Sis. Blessing Nwa','Bro. Emmanuel Okon','Sis. Grace Enu','Bro. Samuel Ogu','Sis. Faith Ada','Bro. Joshua Nna','Sis. Joy Ike','Bro. Daniel Onw','Sis. Peace Ogu','Bro. Caleb Nwa','Sis. Hope Eze','Bro. Aaron Obi','Sis. Ruth Nna']},
  {cell:'Champions Cell',fel:'Youth',leader:'Bro. Tunde Adeleke',members:17,avg:19,rate:88,trend:'+12%',status:'rising',
   history:[14,15,15,16,16,17,17,18,19,19,20,19],members_list:['Bro. Tunde Adeleke','Sis. Funmi Adey','Bro. Segun Ayo','Sis. Lola Babs','Bro. Wale Okon','Sis. Nike Labi','Bro. Dare Ogun','Sis. Kemi Ojo','Bro. Sola Adex','Sis. Yetunde Bello','Bro. Tobi Akin','Sis. Ada Okafor','Bro. Uche Nwosu','Sis. Chidinma Eze','Bro. Gbenga Fash','Sis. Bisi Cole','Bro. Tayo Adey']},
  {cell:'New Dawn Cell',fel:'Youth',leader:'Bro. Segun Afolabi',members:14,avg:16,rate:85,trend:'+14%',status:'rising',
   history:[11,11,12,12,13,14,14,15,15,16,17,16],members_list:['Bro. Segun Afolabi','Sis. Toyin Olu','Bro. Bayo Ade','Sis. Folake Ogun','Bro. Kunle Ojo','Sis. Shade Labi','Bro. Rotimi Adex','Sis. Taiwo Bello','Bro. Kehinde Akin','Sis. Yemi Okafor','Bro. Biodun Nwosu','Sis. Jumoke Eze','Bro. Lanre Nwa','Sis. Bolanle Okon']},
  {cell:'Eagles Cell',fel:'Youth',leader:'Sis. Funmi Adeyemi',members:13,avg:14,rate:79,trend:'+8%',status:'stable',
   history:[10,11,11,12,12,13,13,13,14,14,15,14],members_list:['Sis. Funmi Adeyemi','Bro. Gbola Ade','Sis. Remi Ogun','Bro. Femi Ojo','Sis. Dupe Labi','Bro. Tunji Adex','Sis. Kike Bello','Bro. Bade Akin','Sis. Lade Okafor','Bro. Sade Nwosu','Sis. Tope Eze','Bro. Yomi Nwa','Sis. Joke Okon']},
  {cell:'Dayspring Cell',fel:'Youth',leader:'Bro. Felix Okeke',members:11,avg:12,rate:82,trend:'+9%',status:'stable',
   history:[8,9,9,10,10,11,11,11,12,12,13,12],members_list:['Bro. Felix Okeke','Sis. Amaka Eze','Bro. Chuka Obi','Sis. Nkechi Nwa','Bro. Obi Okon','Sis. Ada Enu','Bro. Ike Ogu','Sis. Chi Ada','Bro. Nna Ike','Sis. Uju Onw','Bro. Oge Nna']},
  {cell:'Overflow Cell',fel:'Youth',leader:'Sis. Amaka Igwe',members:13,avg:14,rate:108,trend:'+5%',status:'stable',
   history:[11,11,12,12,12,13,13,13,14,14,14,14],members_list:['Sis. Amaka Igwe','Bro. Chidi Obi','Sis. Ify Eze','Bro. Emeka Nwa','Sis. Ngo Okon','Bro. Chi Enu','Sis. Ada Ogu','Bro. Ike Ada','Sis. Uju Nna','Bro. Obi Ike','Sis. Nkechi Onw','Bro. Chuka Nna','Sis. Adaeze Nna']},
  {cell:'Breakthrough Cell',fel:'Youth',leader:'Bro. Dayo Ogunleye',members:15,avg:14,rate:70,trend:'+3%',status:'stable',
   history:[11,12,12,13,13,13,14,14,14,15,15,14],members_list:['Bro. Dayo Ogunleye','Sis. Tola Adex','Bro. Ola Fash','Sis. Ronke Ade','Bro. Lekan Ogun','Sis. Sola Ojo','Bro. Wole Labi','Sis. Yemi Adex','Bro. Kola Bello','Sis. Bola Akin','Bro. Toye Okafor','Sis. Toyin Nwosu','Bro. Segun Eze','Sis. Remi Nwa','Bro. Kunle Okon']},
  {cell:'Burning Bush Cell',fel:'Youth',leader:'Bro. Ola Fashola',members:11,avg:13,rate:58,trend:'−14%',status:'alert',
   history:[18,18,17,17,16,16,15,14,14,13,12,13],members_list:['Bro. Ola Fashola','Sis. Bisi Cole','Bro. Tayo Adey','Sis. Lola Babs','Bro. Wale Okon','Sis. Nike Labi','Bro. Dare Ogun','Sis. Kemi Ojo','Bro. Sola Adex','Sis. Yetunde Bello','Bro. Tobi Akin']},
  {cell:'Trumpet Cell',fel:'Youth',leader:'Bro. Seun Ayo',members:12,avg:11,rate:68,trend:'+2%',status:'stable',
   history:[9,9,10,10,10,11,11,11,11,12,12,11],members_list:['Bro. Seun Ayo','Sis. Toyin Olu','Bro. Bayo Ade','Sis. Folake Ogun','Bro. Kunle Ojo','Sis. Shade Labi','Bro. Rotimi Adex','Sis. Taiwo Bello','Bro. Kehinde Akin','Sis. Yemi Okafor','Bro. Biodun Nwosu','Sis. Jumoke Eze']},
  {cell:'Elevation Cell',fel:'Youth',leader:'Bro. Femi Oladele',members:16,avg:15,rate:72,trend:'+4%',status:'stable',
   history:[12,12,13,13,14,14,15,15,15,16,16,15],members_list:['Bro. Femi Oladele','Sis. Gbola Ade','Sis. Remi Ogun','Bro. Tunji Adex','Sis. Kike Bello','Bro. Bade Akin','Sis. Lade Okafor','Bro. Sade Nwosu','Sis. Tope Eze','Bro. Yomi Nwa','Sis. Joke Okon','Bro. Gbola Ade','Sis. Remi Ogu','Bro. Femi Ojo','Sis. Dupe Labi','Bro. Tunji Adex']},
  // Women - 15 cells (indices 12-26)
  {cell:'Fountain of Life Cell',fel:'Women',leader:'Sis. Adaeze Nwosu',members:25,avg:22,rate:88,trend:'+9%',status:'rising',
   history:[18,19,20,20,21,22,22,23,24,24,25,24],members_list:['Sis. Adaeze Nwosu','Sis. Ngozi Obi','Sis. Chioma Uzoma','Sis. Amaka Igwe','Sis. Ifeoma Ada','Sis. Nneka Nwa','Sis. Ada Okafor','Sis. Nkechi Eze','Sis. Adaeze Enu','Sis. Ifeoma Obi','Sis. Ngozi Eze','Sis. Chioma Nwa','Sis. Amaka Okon','Sis. Ngo Enu','Sis. Chi Ada','Sis. Ada Ogu','Sis. Ike Nna','Sis. Uju Ike','Sis. Obi Onw','Sis. Chi Nna','Sis. Nna Nne','Sis. Oge Obi']},
  {cell:'Peace Cell',fel:'Women',leader:'Sis. Ngozi Obi',members:20,avg:21,rate:71,trend:'−2%',status:'watch',
   history:[22,22,22,21,21,21,21,20,20,20,19,21],members_list:['Sis. Ngozi Obi','Sis. Blessing Nnaji','Sis. Joy Okonkwo','Sis. Patience Eze','Sis. Grace Obi','Sis. Mercy Nwosu','Sis. Hope Afolabi','Sis. Faith Adeyemi','Sis. Ruth Adeleke','Sis. Mary Okeke','Sis. Sarah Igwe','Sis. Deborah Uzoma','Sis. Esther Fashola','Sis. Love Nnamdi','Sis. Miriam Okeke','Sis. Hannah Igwe','Sis. Naomi Uzoma','Sis. Abigail Fashola','Sis. Lydia Nnamdi','Sis. Priscilla Okeke']},
  {cell:'Graceland Cell',fel:'Women',leader:'Sis. Joy Okonkwo',members:17,avg:18,rate:76,trend:'+6%',status:'stable',
   history:[14,14,15,15,16,16,17,17,18,18,19,18],members_list:['Sis. Joy Okonkwo','Sis. Dupe Ade','Sis. Tola Ogun','Sis. Bola Ojo','Sis. Yemi Labi','Sis. Sola Adex','Sis. Kike Bello','Sis. Bade Akin','Sis. Lade Okafor','Sis. Sade Nwosu','Sis. Tope Eze','Sis. Yomi Nwa','Sis. Joke Okon','Sis. Gbola Ade','Sis. Remi Ogu','Sis. Femi Ojo','Sis. Tunji Adex']},
  {cell:'Shalom Cell',fel:'Women',leader:'Sis. Blessing Nnaji',members:19,avg:20,rate:74,trend:'+5%',status:'stable',
   history:[16,16,17,17,18,18,19,19,20,20,21,20],members_list:['Sis. Blessing Nnaji','Sis. Peace Obi','Sis. Grace Eze','Sis. Faith Nwa','Sis. Hope Okon','Sis. Joy Enu','Sis. Love Ada','Sis. Ruth Ogu','Sis. Mary Nna','Sis. Sarah Ike','Sis. Deborah Onw','Sis. Esther Nna','Sis. Miriam Nne','Sis. Hannah Obi','Sis. Naomi Eze','Sis. Abigail Nwa','Sis. Lydia Okon','Sis. Priscilla Enu','Sis. Felicia Ada']},
  {cell:'Living Waters Cell',fel:'Women',leader:'Sis. Grace Obi',members:16,avg:17,rate:76,trend:'+6%',status:'stable',
   history:[13,13,14,14,15,15,16,16,17,17,18,17],members_list:['Sis. Grace Obi','Sis. Mercy Nwosu','Sis. Hope Afolabi','Sis. Faith Adeyemi','Sis. Ruth Adeleke','Sis. Mary Okeke','Sis. Sarah Igwe','Sis. Deborah Uzoma','Sis. Esther Fashola','Sis. Love Nnamdi','Sis. Miriam Okeke','Sis. Hannah Igwe','Sis. Naomi Uzoma','Sis. Abigail Fashola','Sis. Lydia Nnamdi','Sis. Priscilla Okeke']},
  {cell:'Harvest Cell',fel:'Women',leader:'Sis. Patience Eze',members:21,avg:22,rate:74,trend:'+5%',status:'stable',
   history:[17,18,18,19,20,20,21,21,22,22,23,22],members_list:['Sis. Patience Eze','Sis. Adaeze Nwosu','Sis. Ngozi Obi','Sis. Chioma Uzoma','Sis. Amaka Igwe','Sis. Ifeoma Ada','Sis. Nneka Nwa','Sis. Ada Okafor','Sis. Nkechi Eze','Sis. Adaeze Enu','Sis. Ifeoma Obi','Sis. Ngozi Eze','Sis. Chioma Nwa','Sis. Amaka Okon','Sis. Ngo Enu','Sis. Chi Ada','Sis. Ada Ogu','Sis. Ike Nna','Sis. Uju Ike','Sis. Obi Onw','Sis. Chi Nna']},
  {cell:'Restoration Cell',fel:'Women',leader:'Sis. Mercy Nwosu',members:18,avg:19,rate:76,trend:'+6%',status:'stable',
   history:[15,15,16,16,17,17,18,18,19,19,20,19],members_list:['Sis. Mercy Nwosu','Sis. Peace Obi','Sis. Grace Eze','Sis. Faith Nwa','Sis. Hope Okon','Sis. Joy Enu','Sis. Love Ada','Sis. Ruth Ogu','Sis. Mary Nna','Sis. Sarah Ike','Sis. Deborah Onw','Sis. Esther Nna','Sis. Miriam Nne','Sis. Hannah Obi','Sis. Naomi Eze','Sis. Abigail Nwa','Sis. Lydia Okon','Sis. Priscilla Enu']},
  {cell:'Tabernacle Cell',fel:'Women',leader:'Sis. Ruth Adeleke',members:10,avg:11,rate:52,trend:'−18%',status:'alert',
   history:[18,18,17,16,15,14,13,13,12,12,11,11],members_list:['Sis. Ruth Adeleke','Sis. Mary Okeke','Sis. Sarah Igwe','Sis. Deborah Uzoma','Sis. Esther Fashola','Sis. Love Nnamdi','Sis. Miriam Okeke','Sis. Hannah Igwe','Sis. Naomi Uzoma','Sis. Abigail Fashola']},
  {cell:'Anchor Cell',fel:'Women',leader:'Sis. Hope Afolabi',members:15,avg:16,rate:78,trend:'+7%',status:'stable',
   history:[12,12,13,13,14,14,15,15,16,16,17,16],members_list:['Sis. Hope Afolabi','Sis. Faith Adeyemi','Sis. Ruth Adeleke','Sis. Mary Okeke','Sis. Sarah Igwe','Sis. Deborah Uzoma','Sis. Esther Fashola','Sis. Love Nnamdi','Sis. Miriam Okeke','Sis. Hannah Igwe','Sis. Naomi Uzoma','Sis. Abigail Fashola','Sis. Lydia Nnamdi','Sis. Priscilla Okeke','Sis. Felicia Ada']},
  {cell:'Emmanuel Cell',fel:'Women',leader:'Sis. Faith Adeyemi',members:17,avg:18,rate:76,trend:'+6%',status:'stable',
   history:[14,14,15,15,16,16,17,17,18,18,19,18],members_list:['Sis. Faith Adeyemi','Sis. Hope Afolabi','Sis. Ruth Adeleke','Sis. Mary Okeke','Sis. Sarah Igwe','Sis. Deborah Uzoma','Sis. Esther Fashola','Sis. Love Nnamdi','Sis. Miriam Okeke','Sis. Hannah Igwe','Sis. Naomi Uzoma','Sis. Abigail Fashola','Sis. Lydia Nnamdi','Sis. Priscilla Okeke','Sis. Felicia Ada','Sis. Grace Obi','Sis. Mercy Nwosu']},
  {cell:'Kingdom Builders Cell',fel:'Women',leader:'Sis. Love Nnamdi',members:19,avg:20,rate:74,trend:'+5%',status:'stable',
   history:[16,16,17,17,18,18,19,19,20,20,21,20],members_list:['Sis. Love Nnamdi','Sis. Faith Adeyemi','Sis. Hope Afolabi','Sis. Ruth Adeleke','Sis. Mary Okeke','Sis. Sarah Igwe','Sis. Deborah Uzoma','Sis. Esther Fashola','Sis. Miriam Okeke','Sis. Hannah Igwe','Sis. Naomi Uzoma','Sis. Abigail Fashola','Sis. Lydia Nnamdi','Sis. Priscilla Okeke','Sis. Felicia Ada','Sis. Grace Obi','Sis. Mercy Nwosu','Sis. Peace Obi','Sis. Joy Enu']},
  {cell:'Cornerstone Cell',fel:'Women',leader:'Sis. Esther Fashola',members:20,avg:21,rate:74,trend:'+5%',status:'stable',
   history:[17,17,18,18,19,19,20,20,21,21,22,21],members_list:['Sis. Esther Fashola','Sis. Love Nnamdi','Sis. Faith Adeyemi','Sis. Hope Afolabi','Sis. Ruth Adeleke','Sis. Mary Okeke','Sis. Sarah Igwe','Sis. Deborah Uzoma','Sis. Miriam Okeke','Sis. Hannah Igwe','Sis. Naomi Uzoma','Sis. Abigail Fashola','Sis. Lydia Nnamdi','Sis. Priscilla Okeke','Sis. Felicia Ada','Sis. Grace Obi','Sis. Mercy Nwosu','Sis. Peace Obi','Sis. Joy Enu','Sis. Love Ada']},
  {cell:'Manifold Blessings Cell',fel:'Women',leader:'Sis. Deborah Uzoma',members:14,avg:15,rate:78,trend:'+7%',status:'stable',
   history:[11,11,12,12,13,13,14,14,15,15,16,15],members_list:['Sis. Deborah Uzoma','Sis. Esther Fashola','Sis. Love Nnamdi','Sis. Faith Adeyemi','Sis. Hope Afolabi','Sis. Ruth Adeleke','Sis. Mary Okeke','Sis. Sarah Igwe','Sis. Miriam Okeke','Sis. Hannah Igwe','Sis. Naomi Uzoma','Sis. Abigail Fashola','Sis. Lydia Nnamdi','Sis. Priscilla Okeke']},
  {cell:'Jubilee Cell',fel:'Women',leader:'Sis. Mary Okeke',members:16,avg:17,rate:76,trend:'+6%',status:'stable',
   history:[13,13,14,14,15,15,16,16,17,17,18,17],members_list:['Sis. Mary Okeke','Sis. Sarah Igwe','Sis. Deborah Uzoma','Sis. Esther Fashola','Sis. Love Nnamdi','Sis. Faith Adeyemi','Sis. Hope Afolabi','Sis. Ruth Adeleke','Sis. Miriam Okeke','Sis. Hannah Igwe','Sis. Naomi Uzoma','Sis. Abigail Fashola','Sis. Lydia Nnamdi','Sis. Priscilla Okeke','Sis. Felicia Ada','Sis. Grace Obi']},
  {cell:'Promised Land Cell',fel:'Women',leader:'Sis. Sarah Igwe',members:15,avg:16,rate:78,trend:'+7%',status:'stable',
   history:[12,12,13,13,14,14,15,15,16,16,17,16],members_list:['Sis. Sarah Igwe','Sis. Mary Okeke','Sis. Deborah Uzoma','Sis. Esther Fashola','Sis. Love Nnamdi','Sis. Faith Adeyemi','Sis. Hope Afolabi','Sis. Ruth Adeleke','Sis. Miriam Okeke','Sis. Hannah Igwe','Sis. Naomi Uzoma','Sis. Abigail Fashola','Sis. Lydia Nnamdi','Sis. Priscilla Okeke','Sis. Felicia Ada']},
  // Men - 8 cells (indices 27-34)
  {cell:'Power House Cell',fel:'Men',leader:'Bro. Daniel Okafor',members:14,avg:15,rate:78,trend:'+7%',status:'stable',
   history:[11,12,12,13,13,14,14,14,15,15,16,15],members_list:['Bro. Daniel Okafor','Bro. Moses Eze','Bro. Aaron Nwosu','Bro. Elijah Adeleke','Bro. Joshua Afolabi','Bro. Samuel Adeyemi','Bro. Paul Nnamdi','Bro. David Okeke','Bro. Solomon Igwe','Bro. Isaiah Uzoma','Bro. Jeremiah Fashola','Bro. Ezekiel Nnamdi','Bro. Daniel Okeke','Bro. Hosea Igwe']},
  {cell:'Covenant Cell',fel:'Men',leader:'Bro. Chukwudi Eze',members:15,avg:17,rate:87,trend:'+13%',status:'rising',
   history:[11,12,12,13,14,14,15,15,16,17,17,17],members_list:['Bro. Chukwudi Eze','Bro. Ifeanyi Obi','Bro. Obiora Nwa','Bro. Emeka Okon','Bro. Chidi Enu','Bro. Kene Ada','Bro. Ike Ogu','Bro. Obi Nna','Bro. Chi Ike','Bro. Nna Onw','Bro. Oge Nna','Bro. Nke Nne','Bro. Uju Obi','Bro. Ada Eze','Bro. Ngo Nwa']},
  {cell:'Dominion Cell',fel:'Men',leader:'Bro. Moses Eze',members:12,avg:13,rate:79,trend:'+8%',status:'stable',
   history:[9,10,10,11,11,12,12,12,13,13,14,13],members_list:['Bro. Moses Eze','Bro. Aaron Nwosu','Bro. Elijah Adeleke','Bro. Joshua Afolabi','Bro. Samuel Adeyemi','Bro. Paul Nnamdi','Bro. David Okeke','Bro. Solomon Igwe','Bro. Isaiah Uzoma','Bro. Jeremiah Fashola','Bro. Ezekiel Nnamdi','Bro. Daniel Okeke']},
  {cell:'Rock of Ages Cell',fel:'Men',leader:'Bro. Aaron Nwosu',members:13,avg:14,rate:79,trend:'+8%',status:'stable',
   history:[10,11,11,12,12,13,13,13,14,14,15,14],members_list:['Bro. Aaron Nwosu','Bro. Elijah Adeleke','Bro. Joshua Afolabi','Bro. Samuel Adeyemi','Bro. Paul Nnamdi','Bro. David Okeke','Bro. Solomon Igwe','Bro. Isaiah Uzoma','Bro. Jeremiah Fashola','Bro. Ezekiel Nnamdi','Bro. Daniel Okeke','Bro. Hosea Igwe','Bro. Amos Uzoma']},
  {cell:'Fortress Cell',fel:'Men',leader:'Bro. Elijah Adeleke',members:11,avg:12,rate:82,trend:'+9%',status:'stable',
   history:[8,9,9,10,10,11,11,11,12,12,13,12],members_list:['Bro. Elijah Adeleke','Bro. Joshua Afolabi','Bro. Samuel Adeyemi','Bro. Paul Nnamdi','Bro. David Okeke','Bro. Solomon Igwe','Bro. Isaiah Uzoma','Bro. Jeremiah Fashola','Bro. Ezekiel Nnamdi','Bro. Daniel Okeke','Bro. Hosea Igwe']},
  {cell:'Solid Rock Cell',fel:'Men',leader:'Bro. Joshua Afolabi',members:15,avg:16,rate:78,trend:'+7%',status:'stable',
   history:[12,12,13,13,14,14,15,15,16,16,17,16],members_list:['Bro. Joshua Afolabi','Bro. Samuel Adeyemi','Bro. Paul Nnamdi','Bro. David Okeke','Bro. Solomon Igwe','Bro. Isaiah Uzoma','Bro. Jeremiah Fashola','Bro. Ezekiel Nnamdi','Bro. Daniel Okeke','Bro. Hosea Igwe','Bro. Amos Uzoma','Bro. Joel Fashola','Bro. Micah Nnamdi','Bro. Nahum Okeke','Bro. Habakkuk Igwe']},
  {cell:'Victory Cell',fel:'Men',leader:'Bro. Samuel Adeyemi',members:13,avg:14,rate:79,trend:'+8%',status:'stable',
   history:[10,11,11,12,12,13,13,13,14,14,15,14],members_list:['Bro. Samuel Adeyemi','Bro. Paul Nnamdi','Bro. David Okeke','Bro. Solomon Igwe','Bro. Isaiah Uzoma','Bro. Jeremiah Fashola','Bro. Ezekiel Nnamdi','Bro. Daniel Okeke','Bro. Hosea Igwe','Bro. Amos Uzoma','Bro. Joel Fashola','Bro. Micah Nnamdi','Bro. Nahum Okeke']},
  {cell:'Lighthouse Cell',fel:'Men',leader:'Bro. Paul Nnamdi',members:10,avg:11,rate:85,trend:'+10%',status:'rising',
   history:[7,7,8,8,9,9,10,10,11,11,12,11],members_list:['Bro. Paul Nnamdi','Bro. David Okeke','Bro. Solomon Igwe','Bro. Isaiah Uzoma','Bro. Jeremiah Fashola','Bro. Ezekiel Nnamdi','Bro. Daniel Okeke','Bro. Hosea Igwe','Bro. Amos Uzoma','Bro. Joel Fashola']},
];

const DEPTS = [
  {name:'Music',cat:'Creative Arts',leader:'Bro. Emeka Okafor',count:38,absent:3,badge:'purple',
   members:[
    {name:'Bro. Emeka Okafor',role:'Lead',phone:'0801-234-5678',present:true},
    {name:'Sis. Chidinma Eze',role:'Vocals',phone:'0802-345-6789',present:true},
    {name:'Bro. Uche Nwosu',role:'Keyboard',phone:'0803-456-7890',present:true},
    {name:'Sis. Ada Okafor',role:'Vocals',phone:'0804-567-8901',present:true},
    {name:'Bro. Tobi Akin',role:'Drums',phone:'0805-678-9012',present:true},
    {name:'Sis. Yetunde Bello',role:'Vocals',phone:'0806-789-0123',present:true},
    {name:'Bro. Dare Ogun',role:'Bass Guitar',phone:'0807-890-1234',present:true},
    {name:'Sis. Kemi Ojo',role:'Vocals',phone:'0808-901-2345',present:true},
    {name:'Bro. Sola Adex',role:'Asst. Lead',phone:'0809-012-3456',present:true},
    {name:'Sis. Nike Labi',role:'Choir',phone:'0810-123-4567',present:true},
    {name:'Bro. Gbenga Fash',role:'Guitar',phone:'0811-234-5678',present:true},
    {name:'Sis. Bisi Cole',role:'Choir',phone:'0812-345-6789',present:true},
    {name:'Bro. Tayo Adey',role:'Choir',phone:'0813-456-7890',present:true},
    {name:'Sis. Lola Babs',role:'Choir',phone:'0814-567-8901',present:true},
    {name:'Bro. Wale Okon',role:'Choir',phone:'0815-678-9012',present:true},
    {name:'Sis. Funke Ade',role:'Choir',phone:'0816-789-0123',present:true},
    {name:'Bro. Seun Ayo',role:'Choir',phone:'0817-890-1234',present:true},
    {name:'Sis. Toyin Olu',role:'Choir',phone:'0818-901-2345',present:true},
    {name:'Bro. Kunle Ojo',role:'Choir',phone:'0819-012-3456',present:true},
    {name:'Sis. Shade Labi',role:'Choir',phone:'0820-123-4567',present:true},
    {name:'Bro. Rotimi Adex',role:'Choir',phone:'0821-234-5678',present:true},
    {name:'Sis. Taiwo Bello',role:'Choir',phone:'0822-345-6789',present:true},
    {name:'Bro. Kehinde Akin',role:'Choir',phone:'0823-456-7890',present:true},
    {name:'Sis. Yemi Okafor',role:'Choir',phone:'0824-567-8901',present:true},
    {name:'Bro. Biodun Nwosu',role:'Choir',phone:'0825-678-9012',present:true},
    {name:'Sis. Jumoke Eze',role:'Choir',phone:'0826-789-0123',present:true},
    {name:'Bro. Lanre Nwa',role:'Choir',phone:'0827-890-1234',present:true},
    {name:'Sis. Bolanle Okon',role:'Choir',phone:'0828-901-2345',present:true},
    {name:'Bro. Gbola Ade',role:'Choir',phone:'0829-012-3456',present:true},
    {name:'Sis. Remi Ogun',role:'Choir',phone:'0830-123-4567',present:true},
    {name:'Bro. Femi Ojo',role:'Choir',phone:'0831-234-5678',present:true},
    {name:'Sis. Dupe Labi',role:'Choir',phone:'0832-345-6789',present:true},
    {name:'Bro. Tunji Adex',role:'Choir',phone:'0833-456-7890',present:true},
    {name:'Sis. Kike Bello',role:'Choir',phone:'0834-567-8901',present:true},
    {name:'Bro. Bade Akin',role:'Choir',phone:'0835-678-9012',present:false,informed:'Yes'},
    {name:'Sis. Lade Okafor',role:'Choir',phone:'0836-789-0123',present:false,informed:'No'},
    {name:'Bro. Sade Nwosu',role:'Choir',phone:'0837-890-1234',present:false,informed:'Yes'},
    {name:'Sis. Tope Eze',role:'Choir',phone:'0838-901-2345',present:true},
  ]},
  {name:'Ushering & Protocol',cat:'Operations',leader:'Sis. Adaeze Nwosu',count:52,absent:4,badge:'teal',
   members:[
    {name:'Sis. Adaeze Nwosu',role:'Lead',phone:'0801-111-0001',present:true},
    {name:'Sis. Ngozi Obi',role:'Coordinator',phone:'0802-111-0002',present:true},
    {name:'Sis. Chioma Uzoma',role:'Member',phone:'0803-111-0003',present:true},
    {name:'Bro. Kelvin Nnamdi',role:'Member',phone:'0804-111-0004',present:true},
    {name:'Sis. Amaka Igwe',role:'Member',phone:'0805-111-0005',present:true},
    {name:'Bro. Felix Okeke',role:'Member',phone:'0806-111-0006',present:true},
    {name:'Bro. Ola Fashola',role:'Member',phone:'0807-111-0007',present:true},
    {name:'Sis. Bisi Cole',role:'Asst. Lead',phone:'0808-111-0008',present:true},
    {name:'Bro. Tayo Adey',role:'Member',phone:'0809-111-0009',present:true},
    {name:'Sis. Lola Babs',role:'Member',phone:'0810-111-0010',present:true},
    {name:'Bro. Wale Okon',role:'Member',phone:'0811-111-0011',present:true},
    {name:'Sis. Funke Ade',role:'Member',phone:'0812-111-0012',present:true},
    {name:'Bro. Seun Ayo',role:'Member',phone:'0813-111-0013',present:true},
    {name:'Sis. Toyin Olu',role:'Member',phone:'0814-111-0014',present:true},
    {name:'Bro. Kunle Ojo',role:'Member',phone:'0815-111-0015',present:true},
    {name:'Sis. Shade Labi',role:'Member',phone:'0816-111-0016',present:true},
    {name:'Bro. Rotimi Adex',role:'Member',phone:'0817-111-0017',present:true},
    {name:'Sis. Taiwo Bello',role:'Member',phone:'0818-111-0018',present:true},
    {name:'Bro. Kehinde Akin',role:'Member',phone:'0819-111-0019',present:true},
    {name:'Sis. Yemi Okafor',role:'Member',phone:'0820-111-0020',present:true},
    {name:'Bro. Biodun Nwosu',role:'Member',phone:'0821-111-0021',present:true},
    {name:'Sis. Jumoke Eze',role:'Member',phone:'0822-111-0022',present:true},
    {name:'Bro. Lanre Nwa',role:'Member',phone:'0823-111-0023',present:true},
    {name:'Sis. Bolanle Okon',role:'Member',phone:'0824-111-0024',present:true},
    {name:'Bro. Gbola Ade',role:'Member',phone:'0825-111-0025',present:true},
    {name:'Sis. Remi Ogun',role:'Member',phone:'0826-111-0026',present:true},
    {name:'Bro. Femi Ojo',role:'Member',phone:'0827-111-0027',present:true},
    {name:'Sis. Dupe Labi',role:'Member',phone:'0828-111-0028',present:true},
    {name:'Bro. Tunji Adex',role:'Member',phone:'0829-111-0029',present:true},
    {name:'Sis. Kike Bello',role:'Member',phone:'0830-111-0030',present:true},
    {name:'Bro. Bade Akin',role:'Member',phone:'0831-111-0031',present:true},
    {name:'Sis. Lade Okafor',role:'Member',phone:'0832-111-0032',present:true},
    {name:'Bro. Sade Nwosu',role:'Member',phone:'0833-111-0033',present:true},
    {name:'Sis. Tope Eze',role:'Member',phone:'0834-111-0034',present:true},
    {name:'Bro. Yomi Nwa',role:'Member',phone:'0835-111-0035',present:true},
    {name:'Sis. Joke Okon',role:'Member',phone:'0836-111-0036',present:true},
    {name:'Bro. Gbola Fash',role:'Member',phone:'0837-111-0037',present:true},
    {name:'Sis. Remi Ade',role:'Member',phone:'0838-111-0038',present:true},
    {name:'Bro. Femi Ogun',role:'Member',phone:'0839-111-0039',present:true},
    {name:'Sis. Dupe Ojo',role:'Member',phone:'0840-111-0040',present:true},
    {name:'Bro. Tunji Labi',role:'Member',phone:'0841-111-0041',present:true},
    {name:'Sis. Kike Adex',role:'Member',phone:'0842-111-0042',present:true},
    {name:'Bro. Bade Bello',role:'Member',phone:'0843-111-0043',present:true},
    {name:'Sis. Lade Akin',role:'Member',phone:'0844-111-0044',present:true},
    {name:'Bro. Sade Okafor',role:'Member',phone:'0845-111-0045',present:true},
    {name:'Sis. Tope Nwosu',role:'Member',phone:'0846-111-0046',present:true},
    {name:'Bro. Yomi Eze',role:'Member',phone:'0847-111-0047',present:true},
    {name:'Sis. Joke Nwa',role:'Member',phone:'0848-111-0048',present:false,informed:'Yes'},
    {name:'Bro. Gbola Okon',role:'Member',phone:'0849-111-0049',present:false,informed:'Yes'},
    {name:'Sis. Remi Fash',role:'Member',phone:'0850-111-0050',present:false,informed:'No'},
    {name:'Bro. Femi Ade',role:'Member',phone:'0851-111-0051',present:false,informed:'Yes'},
    {name:'Sis. Dupe Ogun',role:'Member',phone:'0852-111-0052',present:true},
  ]},
  {name:'Media',cat:'Creative Arts',leader:'Bro. Tunde Adeleke',count:29,absent:2,badge:'amber',
   members:[
    {name:'Bro. Tunde Adeleke',role:'Lead',phone:'0801-222-0001',present:true},
    {name:'Sis. Funmi Adey',role:'Coordinator',phone:'0802-222-0002',present:true},
    {name:'Bro. Segun Ayo',role:'Camera',phone:'0803-222-0003',present:true},
    {name:'Sis. Lola Babs',role:'Graphics',phone:'0804-222-0004',present:true},
    {name:'Bro. Wale Okon',role:'Live Stream',phone:'0805-222-0005',present:true},
    {name:'Sis. Nike Labi',role:'Social Media',phone:'0806-222-0006',present:true},
    {name:'Bro. Dare Ogun',role:'Asst. Lead',phone:'0807-222-0007',present:true},
    {name:'Sis. Kemi Ojo',role:'Photography',phone:'0808-222-0008',present:true},
    {name:'Bro. Sola Adex',role:'Video Edit',phone:'0809-222-0009',present:true},
    {name:'Sis. Yetunde Bello',role:'Design',phone:'0810-222-0010',present:true},
    {name:'Bro. Tobi Akin',role:'Camera',phone:'0811-222-0011',present:true},
    {name:'Sis. Ada Okafor',role:'Social Media',phone:'0812-222-0012',present:true},
    {name:'Bro. Uche Nwosu',role:'Live Stream',phone:'0813-222-0013',present:true},
    {name:'Sis. Chidinma Eze',role:'Graphics',phone:'0814-222-0014',present:true},
    {name:'Bro. Gbenga Fash',role:'Camera',phone:'0815-222-0015',present:true},
    {name:'Sis. Bisi Cole',role:'Photography',phone:'0816-222-0016',present:true},
    {name:'Bro. Tayo Adey',role:'Video Edit',phone:'0817-222-0017',present:true},
    {name:'Sis. Lola Ogun',role:'Design',phone:'0818-222-0018',present:true},
    {name:'Bro. Wale Ade',role:'Camera',phone:'0819-222-0019',present:true},
    {name:'Sis. Nike Ojo',role:'Social Media',phone:'0820-222-0020',present:true},
    {name:'Bro. Dare Labi',role:'Live Stream',phone:'0821-222-0021',present:true},
    {name:'Sis. Kemi Adex',role:'Graphics',phone:'0822-222-0022',present:true},
    {name:'Bro. Sola Bello',role:'Photography',phone:'0823-222-0023',present:true},
    {name:'Sis. Yetunde Akin',role:'Design',phone:'0824-222-0024',present:true},
    {name:'Bro. Tobi Okafor',role:'Camera',phone:'0825-222-0025',present:true},
    {name:'Sis. Ada Nwosu',role:'Social Media',phone:'0826-222-0026',present:true},
    {name:'Bro. Uche Eze',role:'Video Edit',phone:'0827-222-0027',present:true},
    {name:'Sis. Chidinma Fash',role:'Graphics',phone:'0828-222-0028',present:false,informed:'Yes'},
    {name:'Bro. Gbenga Cole',role:'Camera',phone:'0829-222-0029',present:false,informed:'No'},
  ]},
  {name:'Prayer',cat:'Spiritual',leader:'Sis. Ngozi Obi',count:44,absent:2,badge:'purple',
   members:[
    {name:'Sis. Ngozi Obi',role:'Lead',phone:'0801-333-0001',present:true},
    {name:'Sis. Blessing Nnaji',role:'Coordinator',phone:'0802-333-0002',present:true},
    {name:'Sis. Joy Okonkwo',role:'Intercessor',phone:'0803-333-0003',present:true},
    {name:'Sis. Patience Eze',role:'Intercessor',phone:'0804-333-0004',present:true},
    {name:'Bro. Chukwudi Eze',role:'Intercessor',phone:'0805-333-0005',present:true},
    {name:'Bro. Ifeanyi Obi',role:'Intercessor',phone:'0806-333-0006',present:true},
    {name:'Sis. Grace Obi',role:'Intercessor',phone:'0807-333-0007',present:true},
    {name:'Bro. Moses Eze',role:'Asst. Lead',phone:'0808-333-0008',present:true},
    {name:'Sis. Mercy Nwosu',role:'Intercessor',phone:'0809-333-0009',present:true},
    {name:'Bro. Aaron Nwosu',role:'Intercessor',phone:'0810-333-0010',present:true},
    {name:'Sis. Hope Afolabi',role:'Intercessor',phone:'0811-333-0011',present:true},
    {name:'Sis. Faith Adeyemi',role:'Intercessor',phone:'0812-333-0012',present:true},
    {name:'Bro. Daniel Okafor',role:'Intercessor',phone:'0813-333-0013',present:true},
    {name:'Sis. Ruth Adeleke',role:'Intercessor',phone:'0814-333-0014',present:true},
    {name:'Bro. Joshua Afolabi',role:'Intercessor',phone:'0815-333-0015',present:true},
    {name:'Sis. Mary Okeke',role:'Intercessor',phone:'0816-333-0016',present:true},
    {name:'Bro. Samuel Adeyemi',role:'Intercessor',phone:'0817-333-0017',present:true},
    {name:'Sis. Sarah Igwe',role:'Intercessor',phone:'0818-333-0018',present:true},
    {name:'Bro. Paul Nnamdi',role:'Intercessor',phone:'0819-333-0019',present:true},
    {name:'Sis. Deborah Uzoma',role:'Intercessor',phone:'0820-333-0020',present:true},
    {name:'Bro. David Okeke',role:'Intercessor',phone:'0821-333-0021',present:true},
    {name:'Sis. Esther Fashola',role:'Intercessor',phone:'0822-333-0022',present:true},
    {name:'Bro. Solomon Igwe',role:'Intercessor',phone:'0823-333-0023',present:true},
    {name:'Sis. Love Nnamdi',role:'Intercessor',phone:'0824-333-0024',present:true},
    {name:'Bro. Isaiah Uzoma',role:'Intercessor',phone:'0825-333-0025',present:true},
    {name:'Sis. Miriam Okeke',role:'Intercessor',phone:'0826-333-0026',present:true},
    {name:'Bro. Jeremiah Fashola',role:'Intercessor',phone:'0827-333-0027',present:true},
    {name:'Sis. Hannah Igwe',role:'Intercessor',phone:'0828-333-0028',present:true},
    {name:'Bro. Ezekiel Nnamdi',role:'Intercessor',phone:'0829-333-0029',present:true},
    {name:'Sis. Naomi Uzoma',role:'Intercessor',phone:'0830-333-0030',present:true},
    {name:'Bro. Hosea Igwe',role:'Intercessor',phone:'0831-333-0031',present:true},
    {name:'Sis. Abigail Fashola',role:'Intercessor',phone:'0832-333-0032',present:true},
    {name:'Bro. Amos Uzoma',role:'Intercessor',phone:'0833-333-0033',present:true},
    {name:'Sis. Lydia Nnamdi',role:'Intercessor',phone:'0834-333-0034',present:true},
    {name:'Bro. Joel Fashola',role:'Intercessor',phone:'0835-333-0035',present:true},
    {name:'Sis. Priscilla Okeke',role:'Intercessor',phone:'0836-333-0036',present:true},
    {name:'Bro. Micah Nnamdi',role:'Intercessor',phone:'0837-333-0037',present:true},
    {name:'Sis. Felicia Ada',role:'Intercessor',phone:'0838-333-0038',present:true},
    {name:'Bro. Nahum Okeke',role:'Intercessor',phone:'0839-333-0039',present:true},
    {name:'Sis. Elizabeth Igwe',role:'Intercessor',phone:'0840-333-0040',present:true},
    {name:'Bro. Habakkuk Igwe',role:'Intercessor',phone:'0841-333-0041',present:true},
    {name:'Sis. Patience Ada',role:'Intercessor',phone:'0842-333-0042',present:true},
    {name:'Bro. Caleb Nwa',role:'Intercessor',phone:'0843-333-0043',present:false,informed:'Yes'},
    {name:'Sis. Lydia Okon',role:'Intercessor',phone:'0844-333-0044',present:false,informed:'No'},
  ]},
  {name:'Traffic Control',cat:'Operations',leader:'Bro. Segun Afolabi',count:22,absent:1,badge:'teal',
   members:[
    {name:'Bro. Segun Afolabi',role:'Lead',phone:'0801-444-0001',present:true},
    {name:'Bro. Tunde Adeleke',role:'Coordinator',phone:'0802-444-0002',present:true},
    {name:'Bro. Kelvin Nnamdi',role:'Member',phone:'0803-444-0003',present:true},
    {name:'Bro. Felix Okeke',role:'Member',phone:'0804-444-0004',present:true},
    {name:'Bro. Ola Fashola',role:'Member',phone:'0805-444-0005',present:true},
    {name:'Bro. Daniel Okafor',role:'Member',phone:'0806-444-0006',present:true},
    {name:'Bro. Moses Eze',role:'Member',phone:'0807-444-0007',present:true},
    {name:'Bro. Aaron Nwosu',role:'Asst. Lead',phone:'0808-444-0008',present:true},
    {name:'Bro. Elijah Adeleke',role:'Member',phone:'0809-444-0009',present:true},
    {name:'Bro. Joshua Afolabi',role:'Member',phone:'0810-444-0010',present:true},
    {name:'Bro. Samuel Adeyemi',role:'Member',phone:'0811-444-0011',present:true},
    {name:'Bro. Paul Nnamdi',role:'Member',phone:'0812-444-0012',present:true},
    {name:'Bro. David Okeke',role:'Member',phone:'0813-444-0013',present:true},
    {name:'Bro. Solomon Igwe',role:'Member',phone:'0814-444-0014',present:true},
    {name:'Bro. Isaiah Uzoma',role:'Member',phone:'0815-444-0015',present:true},
    {name:'Bro. Jeremiah Fashola',role:'Member',phone:'0816-444-0016',present:true},
    {name:'Bro. Ezekiel Nnamdi',role:'Member',phone:'0817-444-0017',present:true},
    {name:'Bro. Hosea Igwe',role:'Member',phone:'0818-444-0018',present:true},
    {name:'Bro. Amos Uzoma',role:'Member',phone:'0819-444-0019',present:true},
    {name:'Bro. Joel Fashola',role:'Member',phone:'0820-444-0020',present:true},
    {name:'Bro. Micah Nnamdi',role:'Member',phone:'0821-444-0021',present:true},
    {name:'Bro. Nahum Okeke',role:'Member',phone:'0822-444-0022',present:false,informed:'Yes'},
  ]},
  {name:'Greeters',cat:'Hospitality',leader:'Sis. Funmi Adeyemi',count:31,absent:3,badge:'purple',
   members:[
    {name:'Sis. Funmi Adeyemi',role:'Lead',phone:'0801-555-0001',present:true},
    {name:'Sis. Ada Okafor',role:'Coordinator',phone:'0802-555-0002',present:true},
    {name:'Sis. Chidinma Eze',role:'Member',phone:'0803-555-0003',present:true},
    {name:'Sis. Yetunde Bello',role:'Member',phone:'0804-555-0004',present:true},
    {name:'Sis. Kemi Ojo',role:'Member',phone:'0805-555-0005',present:true},
    {name:'Sis. Nike Labi',role:'Asst. Lead',phone:'0806-555-0006',present:true},
    {name:'Sis. Bisi Cole',role:'Member',phone:'0807-555-0007',present:true},
    {name:'Sis. Tayo Adey',role:'Member',phone:'0808-555-0008',present:true},
    {name:'Sis. Lola Babs',role:'Member',phone:'0809-555-0009',present:true},
    {name:'Sis. Wale Okon',role:'Member',phone:'0810-555-0010',present:true},
    {name:'Sis. Funke Ade',role:'Member',phone:'0811-555-0011',present:true},
    {name:'Sis. Seun Ayo',role:'Member',phone:'0812-555-0012',present:true},
    {name:'Sis. Toyin Olu',role:'Member',phone:'0813-555-0013',present:true},
    {name:'Sis. Kunle Ojo',role:'Member',phone:'0814-555-0014',present:true},
    {name:'Sis. Shade Labi',role:'Member',phone:'0815-555-0015',present:true},
    {name:'Sis. Rotimi Adex',role:'Member',phone:'0816-555-0016',present:true},
    {name:'Sis. Taiwo Bello',role:'Member',phone:'0817-555-0017',present:true},
    {name:'Sis. Kehinde Akin',role:'Member',phone:'0818-555-0018',present:true},
    {name:'Sis. Yemi Okafor',role:'Member',phone:'0819-555-0019',present:true},
    {name:'Sis. Biodun Nwosu',role:'Member',phone:'0820-555-0020',present:true},
    {name:'Sis. Jumoke Eze',role:'Member',phone:'0821-555-0021',present:true},
    {name:'Sis. Lanre Nwa',role:'Member',phone:'0822-555-0022',present:true},
    {name:'Sis. Bolanle Okon',role:'Member',phone:'0823-555-0023',present:true},
    {name:'Sis. Gbola Ade',role:'Member',phone:'0824-555-0024',present:true},
    {name:'Sis. Remi Ogun',role:'Member',phone:'0825-555-0025',present:true},
    {name:'Sis. Femi Ojo',role:'Member',phone:'0826-555-0026',present:true},
    {name:'Sis. Dupe Labi',role:'Member',phone:'0827-555-0027',present:true},
    {name:'Sis. Tunji Adex',role:'Member',phone:'0828-555-0028',present:true},
    {name:'Sis. Kike Bello',role:'Member',phone:'0829-555-0029',present:false,informed:'Yes'},
    {name:'Sis. Bade Akin',role:'Member',phone:'0830-555-0030',present:false,informed:'No'},
    {name:'Sis. Lade Okafor',role:'Member',phone:'0831-555-0031',present:false,informed:'Yes'},
  ]},
  {name:'Sanctuary Keepers',cat:'Operations',leader:'Bro. Kelvin Nnamdi',count:18,absent:1,badge:'teal',
   members:[
    {name:'Bro. Kelvin Nnamdi',role:'Lead',phone:'0801-666-0001',present:true},
    {name:'Bro. Felix Okeke',role:'Coordinator',phone:'0802-666-0002',present:true},
    {name:'Bro. Ola Fashola',role:'Member',phone:'0803-666-0003',present:true},
    {name:'Bro. Daniel Okafor',role:'Asst. Lead',phone:'0804-666-0004',present:true},
    {name:'Bro. Moses Eze',role:'Member',phone:'0805-666-0005',present:true},
    {name:'Bro. Aaron Nwosu',role:'Member',phone:'0806-666-0006',present:true},
    {name:'Bro. Elijah Adeleke',role:'Member',phone:'0807-666-0007',present:true},
    {name:'Bro. Joshua Afolabi',role:'Member',phone:'0808-666-0008',present:true},
    {name:'Bro. Samuel Adeyemi',role:'Member',phone:'0809-666-0009',present:true},
    {name:'Bro. Paul Nnamdi',role:'Member',phone:'0810-666-0010',present:true},
    {name:'Bro. David Okeke',role:'Member',phone:'0811-666-0011',present:true},
    {name:'Bro. Solomon Igwe',role:'Member',phone:'0812-666-0012',present:true},
    {name:'Bro. Isaiah Uzoma',role:'Member',phone:'0813-666-0013',present:true},
    {name:'Bro. Jeremiah Fashola',role:'Member',phone:'0814-666-0014',present:true},
    {name:'Bro. Ezekiel Nnamdi',role:'Member',phone:'0815-666-0015',present:true},
    {name:'Bro. Hosea Igwe',role:'Member',phone:'0816-666-0016',present:true},
    {name:'Bro. Amos Uzoma',role:'Member',phone:'0817-666-0017',present:true},
    {name:'Bro. Joel Fashola',role:'Member',phone:'0818-666-0018',present:false,informed:'Yes'},
  ]},
  {name:'Security & Maintenance',cat:'Operations',leader:'Bro. Ola Fashola',count:27,absent:2,badge:'amber',
   members:[
    {name:'Bro. Ola Fashola',role:'Lead',phone:'0801-777-0001',present:true},
    {name:'Bro. Daniel Okafor',role:'Coordinator',phone:'0802-777-0002',present:true},
    {name:'Bro. Moses Eze',role:'Member',phone:'0803-777-0003',present:true},
    {name:'Bro. Aaron Nwosu',role:'Member',phone:'0804-777-0004',present:true},
    {name:'Bro. Elijah Adeleke',role:'Asst. Lead',phone:'0805-777-0005',present:true},
    {name:'Bro. Joshua Afolabi',role:'Member',phone:'0806-777-0006',present:true},
    {name:'Bro. Samuel Adeyemi',role:'Member',phone:'0807-777-0007',present:true},
    {name:'Bro. Paul Nnamdi',role:'Member',phone:'0808-777-0008',present:true},
    {name:'Bro. David Okeke',role:'Member',phone:'0809-777-0009',present:true},
    {name:'Bro. Solomon Igwe',role:'Member',phone:'0810-777-0010',present:true},
    {name:'Bro. Isaiah Uzoma',role:'Member',phone:'0811-777-0011',present:true},
    {name:'Bro. Jeremiah Fashola',role:'Member',phone:'0812-777-0012',present:true},
    {name:'Bro. Ezekiel Nnamdi',role:'Member',phone:'0813-777-0013',present:true},
    {name:'Bro. Hosea Igwe',role:'Member',phone:'0814-777-0014',present:true},
    {name:'Bro. Amos Uzoma',role:'Member',phone:'0815-777-0015',present:true},
    {name:'Bro. Joel Fashola',role:'Member',phone:'0816-777-0016',present:true},
    {name:'Bro. Micah Nnamdi',role:'Member',phone:'0817-777-0017',present:true},
    {name:'Bro. Nahum Okeke',role:'Member',phone:'0818-777-0018',present:true},
    {name:'Bro. Habakkuk Igwe',role:'Member',phone:'0819-777-0019',present:true},
    {name:'Bro. Caleb Nwa',role:'Member',phone:'0820-777-0020',present:true},
    {name:'Bro. Seun Ayo',role:'Member',phone:'0821-777-0021',present:true},
    {name:'Bro. Tobi Akin',role:'Member',phone:'0822-777-0022',present:true},
    {name:'Bro. Wale Okon',role:'Member',phone:'0823-777-0023',present:true},
    {name:'Bro. Kunle Ojo',role:'Member',phone:'0824-777-0024',present:true},
    {name:'Bro. Rotimi Adex',role:'Member',phone:'0825-777-0025',present:true},
    {name:'Bro. Kehinde Akin',role:'Member',phone:'0826-777-0026',present:false,informed:'Yes'},
    {name:'Bro. Biodun Nwosu',role:'Member',phone:'0827-777-0027',present:false,informed:'No'},
  ]},
  {name:'Sound Engineers',cat:'Technical',leader:'Bro. Felix Okeke',count:14,absent:1,badge:'purple',
   members:[
    {name:'Bro. Felix Okeke',role:'Lead',phone:'0801-888-0001',present:true},
    {name:'Bro. Ola Fashola',role:'Coordinator',phone:'0802-888-0002',present:true},
    {name:'Bro. Daniel Okafor',role:'Engineer',phone:'0803-888-0003',present:true},
    {name:'Bro. Moses Eze',role:'Asst. Lead',phone:'0804-888-0004',present:true},
    {name:'Bro. Aaron Nwosu',role:'Engineer',phone:'0805-888-0005',present:true},
    {name:'Bro. Elijah Adeleke',role:'Engineer',phone:'0806-888-0006',present:true},
    {name:'Bro. Joshua Afolabi',role:'Engineer',phone:'0807-888-0007',present:true},
    {name:'Bro. Samuel Adeyemi',role:'Engineer',phone:'0808-888-0008',present:true},
    {name:'Bro. Paul Nnamdi',role:'Engineer',phone:'0809-888-0009',present:true},
    {name:'Bro. David Okeke',role:'Engineer',phone:'0810-888-0010',present:true},
    {name:'Bro. Solomon Igwe',role:'Engineer',phone:'0811-888-0011',present:true},
    {name:'Bro. Isaiah Uzoma',role:'Engineer',phone:'0812-888-0012',present:true},
    {name:'Bro. Jeremiah Fashola',role:'Engineer',phone:'0813-888-0013',present:true},
    {name:'Bro. Ezekiel Nnamdi',role:'Engineer',phone:'0814-888-0014',present:false,informed:'Yes'},
  ]},
  {name:'Teachers & Educators',cat:'Ministry',leader:'Sis. Chioma Uzoma',count:33,absent:2,badge:'teal',
   members:[
    {name:'Sis. Chioma Uzoma',role:'Lead',phone:'0801-999-0001',present:true},
    {name:'Sis. Amaka Igwe',role:'Coordinator',phone:'0802-999-0002',present:true},
    {name:'Sis. Ifeoma Ada',role:'Teacher',phone:'0803-999-0003',present:true},
    {name:'Sis. Nneka Nwa',role:'Teacher',phone:'0804-999-0004',present:true},
    {name:'Sis. Ada Okafor',role:'Asst. Lead',phone:'0805-999-0005',present:true},
    {name:'Sis. Nkechi Eze',role:'Teacher',phone:'0806-999-0006',present:true},
    {name:'Sis. Adaeze Enu',role:'Teacher',phone:'0807-999-0007',present:true},
    {name:'Bro. Daniel Okafor',role:'Teacher',phone:'0808-999-0008',present:true},
    {name:'Bro. Moses Eze',role:'Teacher',phone:'0809-999-0009',present:true},
    {name:'Sis. Grace Obi',role:'Teacher',phone:'0810-999-0010',present:true},
    {name:'Bro. Samuel Adeyemi',role:'Teacher',phone:'0811-999-0011',present:true},
    {name:'Sis. Faith Adeyemi',role:'Teacher',phone:'0812-999-0012',present:true},
    {name:'Bro. David Okeke',role:'Teacher',phone:'0813-999-0013',present:true},
    {name:'Sis. Hope Afolabi',role:'Teacher',phone:'0814-999-0014',present:true},
    {name:'Bro. Joshua Afolabi',role:'Teacher',phone:'0815-999-0015',present:true},
    {name:'Sis. Mercy Nwosu',role:'Teacher',phone:'0816-999-0016',present:true},
    {name:'Bro. Paul Nnamdi',role:'Teacher',phone:'0817-999-0017',present:true},
    {name:'Sis. Ruth Adeleke',role:'Teacher',phone:'0818-999-0018',present:true},
    {name:'Bro. Aaron Nwosu',role:'Teacher',phone:'0819-999-0019',present:true},
    {name:'Sis. Mary Okeke',role:'Teacher',phone:'0820-999-0020',present:true},
    {name:'Bro. Elijah Adeleke',role:'Teacher',phone:'0821-999-0021',present:true},
    {name:'Sis. Sarah Igwe',role:'Teacher',phone:'0822-999-0022',present:true},
    {name:'Bro. Solomon Igwe',role:'Teacher',phone:'0823-999-0023',present:true},
    {name:'Sis. Deborah Uzoma',role:'Teacher',phone:'0824-999-0024',present:true},
    {name:'Bro. Isaiah Uzoma',role:'Teacher',phone:'0825-999-0025',present:true},
    {name:'Sis. Esther Fashola',role:'Teacher',phone:'0826-999-0026',present:true},
    {name:'Bro. Jeremiah Fashola',role:'Teacher',phone:'0827-999-0027',present:true},
    {name:'Sis. Love Nnamdi',role:'Teacher',phone:'0828-999-0028',present:true},
    {name:'Bro. Ezekiel Nnamdi',role:'Teacher',phone:'0829-999-0029',present:true},
    {name:'Sis. Miriam Okeke',role:'Teacher',phone:'0830-999-0030',present:true},
    {name:'Bro. Hosea Igwe',role:'Teacher',phone:'0831-999-0031',present:true},
    {name:'Sis. Hannah Igwe',role:'Teacher',phone:'0832-999-0032',present:false,informed:'Yes'},
    {name:'Bro. Amos Uzoma',role:'Teacher',phone:'0833-999-0033',present:false,informed:'No'},
  ]},
  {name:'Church Administration',cat:'Admin',leader:'Sis. Amaka Igwe',count:18,absent:1,badge:'purple',
   members:[
    {name:'Sis. Amaka Igwe',role:'Lead',phone:'0801-100-0001',present:true},
    {name:'Sis. Ifeoma Ada',role:'Secretary',phone:'0802-100-0002',present:true},
    {name:'Sis. Nneka Nwa',role:'Treasurer',phone:'0803-100-0003',present:true},
    {name:'Sis. Ada Okafor',role:'Admin',phone:'0804-100-0004',present:true},
    {name:'Bro. Daniel Okafor',role:'Asst. Lead',phone:'0805-100-0005',present:true},
    {name:'Bro. Moses Eze',role:'Admin',phone:'0806-100-0006',present:true},
    {name:'Bro. Aaron Nwosu',role:'Admin',phone:'0807-100-0007',present:true},
    {name:'Sis. Nkechi Eze',role:'Records',phone:'0808-100-0008',present:true},
    {name:'Sis. Adaeze Enu',role:'Records',phone:'0809-100-0009',present:true},
    {name:'Bro. Elijah Adeleke',role:'Admin',phone:'0810-100-0010',present:true},
    {name:'Bro. Joshua Afolabi',role:'Admin',phone:'0811-100-0011',present:true},
    {name:'Sis. Grace Obi',role:'Admin',phone:'0812-100-0012',present:true},
    {name:'Bro. Samuel Adeyemi',role:'Admin',phone:'0813-100-0013',present:true},
    {name:'Sis. Faith Adeyemi',role:'Admin',phone:'0814-100-0014',present:true},
    {name:'Bro. David Okeke',role:'Admin',phone:'0815-100-0015',present:true},
    {name:'Sis. Hope Afolabi',role:'Admin',phone:'0816-100-0016',present:true},
    {name:'Bro. Joshua Afolabi',role:'Admin',phone:'0817-100-0017',present:true},
    {name:'Sis. Mercy Nwosu',role:'Admin',phone:'0818-100-0018',present:false,informed:'Yes'},
  ]},
  {name:'Dev Team & Builders',cat:'Technical',leader:'Bro. Dayo Ogunleye',count:9,absent:0,badge:'amber',
   members:[
    {name:'Bro. Dayo Ogunleye',role:'Lead',phone:'0801-200-0001',present:true},
    {name:'Bro. Tunde Adeleke',role:'Developer',phone:'0802-200-0002',present:true},
    {name:'Bro. Felix Okeke',role:'Developer',phone:'0803-200-0003',present:true},
    {name:'Bro. Ola Fashola',role:'Asst. Lead',phone:'0804-200-0004',present:true},
    {name:'Bro. Daniel Okafor',role:'Developer',phone:'0805-200-0005',present:true},
    {name:'Bro. Moses Eze',role:'Developer',phone:'0806-200-0006',present:true},
    {name:'Bro. Aaron Nwosu',role:'Developer',phone:'0807-200-0007',present:true},
    {name:'Bro. Elijah Adeleke',role:'Developer',phone:'0808-200-0008',present:true},
    {name:'Bro. Joshua Afolabi',role:'Developer',phone:'0809-200-0009',present:true},
  ]},
];



const ALL_MEMBERS = [
  // Glory House Cell - Youth
  {name:'Bro. Emeka Okafor',phone:'0801-234-5678',cell:'Glory House Cell',fellowship:'Youth',joined:'Jan 12 2022',status:'Active',gender:'Male',age:28},
  {name:'Sis. Chidinma Eze',phone:'0802-345-6789',cell:'Glory House Cell',fellowship:'Youth',joined:'Mar 5 2022',status:'Active',gender:'Female',age:24},
  {name:'Bro. Uche Nwosu',phone:'0803-456-7890',cell:'Glory House Cell',fellowship:'Youth',joined:'Jun 18 2022',status:'Active',gender:'Male',age:26},
  {name:'Sis. Ada Okafor',phone:'0804-567-8901',cell:'Glory House Cell',fellowship:'Youth',joined:'Aug 2 2022',status:'Active',gender:'Female',age:22},
  {name:'Bro. Tobi Akin',phone:'0805-678-9012',cell:'Glory House Cell',fellowship:'Youth',joined:'Sep 14 2022',status:'Active',gender:'Male',age:25},
  {name:'Sis. Yetunde Bello',phone:'0806-789-0123',cell:'Glory House Cell',fellowship:'Youth',joined:'Nov 8 2022',status:'Active',gender:'Female',age:23},
  {name:'Bro. Dare Ogun',phone:'0807-890-1234',cell:'Glory House Cell',fellowship:'Youth',joined:'Jan 20 2023',status:'Active',gender:'Male',age:27},
  {name:'Sis. Kemi Ojo',phone:'0808-901-2345',cell:'Glory House Cell',fellowship:'Youth',joined:'Feb 14 2023',status:'Active',gender:'Female',age:21},
  // Covenant Cell - Men
  {name:'Bro. Chukwudi Eze',phone:'0801-111-2001',cell:'Covenant Cell',fellowship:'Men',joined:'Feb 3 2021',status:'Active',gender:'Male',age:35},
  {name:'Bro. Ifeanyi Obi',phone:'0802-111-2002',cell:'Covenant Cell',fellowship:'Men',joined:'Apr 17 2021',status:'Active',gender:'Male',age:38},
  {name:'Bro. Obiora Nwa',phone:'0803-111-2003',cell:'Covenant Cell',fellowship:'Men',joined:'Jul 9 2021',status:'Active',gender:'Male',age:32},
  {name:'Bro. Emeka Okon',phone:'0804-111-2004',cell:'Covenant Cell',fellowship:'Men',joined:'Oct 22 2021',status:'Active',gender:'Male',age:41},
  {name:'Bro. Chidi Enu',phone:'0805-111-2005',cell:'Covenant Cell',fellowship:'Men',joined:'Jan 5 2022',status:'Active',gender:'Male',age:36},
  {name:'Bro. Kene Ada',phone:'0806-111-2006',cell:'Covenant Cell',fellowship:'Men',joined:'Mar 19 2022',status:'Active',gender:'Male',age:29},
  {name:'Bro. Ike Ogu',phone:'0807-111-2007',cell:'Covenant Cell',fellowship:'Men',joined:'Jun 1 2022',status:'Active',gender:'Male',age:44},
  {name:'Bro. Obi Nna',phone:'0808-111-2008',cell:'Covenant Cell',fellowship:'Men',joined:'Aug 15 2022',status:'Active',gender:'Male',age:33},
  // Fountain of Life Cell - Women
  {name:'Sis. Adaeze Nwosu',phone:'0801-222-3001',cell:'Fountain of Life Cell',fellowship:'Women',joined:'Jan 8 2020',status:'Active',gender:'Female',age:34},
  {name:'Sis. Ngozi Obi',phone:'0802-222-3002',cell:'Fountain of Life Cell',fellowship:'Women',joined:'Mar 12 2020',status:'Active',gender:'Female',age:31},
  {name:'Sis. Chioma Uzoma',phone:'0803-222-3003',cell:'Fountain of Life Cell',fellowship:'Women',joined:'May 25 2020',status:'Active',gender:'Female',age:28},
  {name:'Sis. Amaka Igwe',phone:'0804-222-3004',cell:'Fountain of Life Cell',fellowship:'Women',joined:'Aug 7 2020',status:'Active',gender:'Female',age:36},
  {name:'Sis. Ifeoma Ada',phone:'0805-222-3005',cell:'Fountain of Life Cell',fellowship:'Women',joined:'Nov 19 2020',status:'Active',gender:'Female',age:29},
  {name:'Sis. Nneka Nwa',phone:'0806-222-3006',cell:'Fountain of Life Cell',fellowship:'Women',joined:'Feb 14 2021',status:'Active',gender:'Female',age:33},
  {name:'Sis. Ada Okafor',phone:'0807-222-3007',cell:'Fountain of Life Cell',fellowship:'Women',joined:'May 8 2021',status:'Active',gender:'Female',age:27},
  {name:'Sis. Nkechi Eze',phone:'0808-222-3008',cell:'Fountain of Life Cell',fellowship:'Women',joined:'Aug 22 2021',status:'Active',gender:'Female',age:30},
  // Power House Cell - Men
  {name:'Bro. Daniel Okafor',phone:'0801-333-4001',cell:'Power House Cell',fellowship:'Men',joined:'Mar 4 2021',status:'Active',gender:'Male',age:40},
  {name:'Bro. Moses Eze',phone:'0802-333-4002',cell:'Power House Cell',fellowship:'Men',joined:'Jun 18 2021',status:'Active',gender:'Male',age:37},
  {name:'Bro. Aaron Nwosu',phone:'0803-333-4003',cell:'Power House Cell',fellowship:'Men',joined:'Sep 2 2021',status:'Active',gender:'Male',age:43},
  {name:'Bro. Elijah Adeleke',phone:'0804-333-4004',cell:'Power House Cell',fellowship:'Men',joined:'Dec 14 2021',status:'Active',gender:'Male',age:39},
  {name:'Bro. Joshua Afolabi',phone:'0805-333-4005',cell:'Power House Cell',fellowship:'Men',joined:'Mar 9 2022',status:'Active',gender:'Male',age:35},
  {name:'Bro. Samuel Adeyemi',phone:'0806-333-4006',cell:'Power House Cell',fellowship:'Men',joined:'Jun 21 2022',status:'Active',gender:'Male',age:42},
  {name:'Bro. Paul Nnamdi',phone:'0807-333-4007',cell:'Power House Cell',fellowship:'Men',joined:'Sep 5 2022',status:'Active',gender:'Male',age:38},
  // Peace Cell - Women (watch status)
  {name:'Sis. Ngozi Obi',phone:'0801-444-5001',cell:'Peace Cell',fellowship:'Women',joined:'Apr 11 2021',status:'Active',gender:'Female',age:35},
  {name:'Sis. Blessing Nnaji',phone:'0802-444-5002',cell:'Peace Cell',fellowship:'Women',joined:'Jul 3 2021',status:'Active',gender:'Female',age:32},
  {name:'Sis. Joy Okonkwo',phone:'0803-444-5003',cell:'Peace Cell',fellowship:'Women',joined:'Oct 15 2021',status:'Active',gender:'Female',age:28},
  {name:'Sis. Patience Eze',phone:'0804-444-5004',cell:'Peace Cell',fellowship:'Women',joined:'Jan 8 2022',status:'Active',gender:'Female',age:37},
  {name:'Sis. Grace Obi',phone:'0805-444-5005',cell:'Peace Cell',fellowship:'Women',joined:'Apr 22 2022',status:'Active',gender:'Female',age:30},
  // Burning Bush Cell - Youth (alert status)
  {name:'Bro. Ola Fashola',phone:'0801-555-6001',cell:'Burning Bush Cell',fellowship:'Youth',joined:'Feb 14 2022',status:'Active',gender:'Male',age:24},
  {name:'Sis. Bisi Cole',phone:'0802-555-6002',cell:'Burning Bush Cell',fellowship:'Youth',joined:'May 7 2022',status:'Active',gender:'Female',age:22},
  {name:'Bro. Tayo Adey',phone:'0803-555-6003',cell:'Burning Bush Cell',fellowship:'Youth',joined:'Aug 19 2022',status:'Active',gender:'Male',age:25},
  {name:'Sis. Lola Babs',phone:'0804-555-6004',cell:'Burning Bush Cell',fellowship:'Youth',joined:'Nov 2 2022',status:'Inactive',gender:'Female',age:23},
  {name:'Bro. Wale Okon',phone:'0805-555-6005',cell:'Burning Bush Cell',fellowship:'Youth',joined:'Jan 16 2023',status:'Inactive',gender:'Male',age:26},
  {name:'Sis. Nike Labi',phone:'0806-555-6006',cell:'Burning Bush Cell',fellowship:'Youth',joined:'Mar 30 2023',status:'Inactive',gender:'Female',age:21},
  {name:'Bro. Dare Ogun',phone:'0807-555-6007',cell:'Burning Bush Cell',fellowship:'Youth',joined:'Jun 13 2023',status:'Active',gender:'Male',age:27},
  {name:'Sis. Kemi Ojo',phone:'0808-555-6008',cell:'Burning Bush Cell',fellowship:'Youth',joined:'Aug 27 2023',status:'Active',gender:'Female',age:20},
];

const NEW_MEMBERS = [
  {name:'Blessing Okonkwo',date:'Jun 3 2026',cell:'Glory House Cell',fellowship:'Youth',care:'Bro. Tunde Adeleke',status:'Staying',invited:'Walk-in',phone:'0801-111-2222'},
  {name:'Chukwudi Eze Jr.',date:'Jun 3 2026',cell:'Covenant Cell',fellowship:'Men',care:'Sis. Ngozi Obi',status:'Staying',invited:'Bro. Emeka Okafor',phone:'0802-222-3333'},
  {name:'Adaeze Nwachukwu',date:'May 27 2026',cell:'Fountain of Life Cell',fellowship:'Women',care:'Sis. Adaeze Nwosu',status:'Visiting',invited:'Crusade',phone:'0803-333-4444'},
  {name:'Segun Balogun',date:'May 27 2026',cell:'Champions Cell',fellowship:'Youth',care:'Bro. Segun Afolabi',status:'Staying',invited:'Referral',phone:'0804-444-5555'},
  {name:'Ngozi Aneke',date:'May 20 2026',cell:'Shalom Cell',fellowship:'Women',care:'Sis. Grace Obi',status:'Staying',invited:'Online',phone:'0805-555-6666'},
  {name:'Felix Udeh',date:'May 20 2026',cell:'Power House Cell',fellowship:'Men',care:'Bro. Daniel Okafor',status:'Staying',invited:'Walk-in',phone:'0806-666-7777'},
  {name:'Amaka Obi',date:'May 13 2026',cell:'Peace Cell',fellowship:'Women',care:'Sis. Mercy Nwosu',status:'Visiting',invited:'Bro. Emeka Okafor',phone:'0807-777-8888'},
  {name:'Kelvin Abara',date:'May 13 2026',cell:'Eagles Cell',fellowship:'Youth',care:'Sis. Funmi Adeyemi',status:'Staying',invited:'Cell outreach',phone:'0808-888-9999'},
];

const GIVING_DATA = [
  {p:'Jan 21',t:820000,o:590000,s:45000},{p:'Feb 21',t:798000,o:572000,s:32000},{p:'Mar 21',t:912000,o:654000,s:88000},
  {p:'Apr 21',t:881000,o:631000,s:55000},{p:'May 21',t:944000,o:677000,s:102000},{p:'Jun 21',t:921000,o:661000,s:71000},
  {p:'Jul 21',t:899000,o:645000,s:48000},{p:'Aug 21',t:872000,o:625000,s:38000},{p:'Sep 21',t:935000,o:671000,s:65000},
  {p:'Oct 21',t:958000,o:688000,s:78000},{p:'Nov 21',t:982000,o:704000,s:95000},{p:'Dec 21',t:1248000,o:895000,s:312000},
  {p:'Jan 22',t:891000,o:639000,s:52000},{p:'Feb 22',t:918000,o:659000,s:61000},{p:'Mar 22',t:1024000,o:735000,s:98000},
  {p:'Apr 22',t:998000,o:716000,s:74000},{p:'May 22',t:1045000,o:750000,s:118000},{p:'Jun 22',t:1021000,o:732000,s:85000},
  {p:'Jul 22',t:995000,o:714000,s:62000},{p:'Aug 22',t:968000,o:694000,s:49000},{p:'Sep 22',t:1038000,o:745000,s:88000},
  {p:'Oct 22',t:1065000,o:764000,s:105000},{p:'Nov 22',t:1092000,o:784000,s:125000},{p:'Dec 22',t:1385000,o:993000,s:345000},
  {p:'Jan 23',t:982000,o:704000,s:58000},{p:'Feb 23',t:1015000,o:728000,s:72000},{p:'Mar 23',t:1128000,o:809000,s:112000},
  {p:'Apr 23',t:1098000,o:787000,s:84000},{p:'May 23',t:1154000,o:828000,s:138000},{p:'Jun 23',t:1125000,o:808000,s:98000},
  {p:'Jul 23',t:1098000,o:787000,s:75000},{p:'Aug 23',t:1065000,o:764000,s:55000},{p:'Sep 23',t:1145000,o:821000,s:102000},
  {p:'Oct 23',t:1178000,o:845000,s:128000},{p:'Nov 23',t:1212000,o:870000,s:155000},{p:'Dec 23',t:1542000,o:1106000,s:412000},
  {p:'Jan 24',t:1085000,o:778000,s:65000},{p:'Feb 24',t:1124000,o:807000,s:85000},{p:'Mar 24',t:1248000,o:895000,s:132000},
  {p:'Apr 24',t:1215000,o:872000,s:98000},{p:'May 24',t:1278000,o:917000,s:162000},{p:'Jun 24',t:1248000,o:895000,s:115000},
  {p:'Jul 24',t:1215000,o:872000,s:88000},{p:'Aug 24',t:1178000,o:845000,s:65000},{p:'Sep 24',t:1268000,o:910000,s:118000},
  {p:'Oct 24',t:1305000,o:937000,s:148000},{p:'Nov 24',t:1342000,o:963000,s:178000},{p:'Dec 24',t:1698000,o:1219000,s:465000},
  {p:'Jan 25',t:1198000,o:860000,s:72000},{p:'Feb 25',t:1242000,o:891000,s:95000},{p:'Mar 25',t:1381000,o:991000,s:148000},
  {p:'Apr 25',t:1345000,o:965000,s:112000},{p:'May 25',t:1412000,o:1014000,s:188000},{p:'Jun 25',t:1378000,o:989000,s:138000},
  {p:'Jul 25',t:1342000,o:963000,s:102000},{p:'Aug 25',t:1305000,o:937000,s:78000},{p:'Sep 25',t:1398000,o:1003000,s:135000},
  {p:'Oct 25',t:1438000,o:1032000,s:168000},{p:'Nov 25',t:1481000,o:1063000,s:205000},{p:'Dec 25',t:1878000,o:1348000,s:525000},
  {p:'Jan 26',t:1240000,o:890000,s:72000},{p:'Feb 26',t:1180000,o:820000,s:55000},{p:'Mar 26',t:1320000,o:940000,s:112000},
  {p:'Apr 26',t:1290000,o:910000,s:88000},{p:'May 26',t:1410000,o:1020000,s:158000},{p:'Jun 26',t:1380000,o:980000,s:128000},
];

const LIVE_FEED = [
  {cell:'Glory House Cell',fellowship:'Youth Fellowship',present:18,visitors:2,mins:3},
  {cell:'Covenant Cell',fellowship:'Men Fellowship',present:14,visitors:1,mins:8},
  {cell:'Fountain of Life Cell',fellowship:'Women Fellowship',present:22,visitors:3,mins:15},
  {cell:'Champions Cell',fellowship:'Youth Fellowship',present:16,visitors:0,mins:22},
  {cell:'Peace Cell',fellowship:'Women Fellowship',present:19,visitors:2,mins:31},
];

const GIVING_PIE = [{name:'Tithe',value:75,color:'#534AB7'},{name:'Offering',value:15,color:'#1D9E75'},{name:'Special',value:7,color:'#BA7517'},{name:'Project',value:3,color:'#D85A30'}];

// ── Helpers ────────────────────────────────────────────────────
function fmt(n:number|undefined|null){return n!=null?n.toLocaleString():'—';}
function fmtNGN(n:number){if(n>=1_000_000)return`₦${(n/1_000_000).toFixed(1)}M`;if(n>=1_000)return`₦${(n/1_000).toFixed(0)}k`;return`₦${n}`;}
function greeting(){const h=new Date().getHours();return h<12?'Good morning':h<17?'Good afternoon':'Good evening';}

function givingSlice(range:string){const m:Record<string,number>={'6m':6,'1y':12,'2y':24,'5y':60};return GIVING_DATA.slice(-(m[range]||12));}

// Attendance trend for a cell — generate based on cell's unique history + range
function cellTrend(cell:typeof CELLS_DATA[0], range:string){
  const counts:Record<string,number>={'8w':8,'3m':13,'6m':26,'1y':52,'2y':104,'5y':260};
  const n = counts[range] || 8;
  const h = cell.history; // 12 weeks of real history
  const baseAvg = h.reduce((a,b)=>a+b,0)/h.length;
  // Growth rate per week based on cell trend
  const weeklyGrowth = cell.status==='rising'?0.003:cell.status==='alert'?-0.004:cell.status==='watch'?-0.001:0.001;
  return Array.from({length:n},(_,i)=>{
    // For recent weeks use actual history, for older weeks extrapolate backwards with growth
    const weeksAgo = n - 1 - i;
    const base = weeksAgo < h.length ? h[h.length-1-weeksAgo] : Math.max(2, Math.round(baseAvg * (1 - weeklyGrowth * weeksAgo)));
    // Add realistic weekly noise (sunday variation, holidays etc)
    const seasonalFactor = Math.sin(i * 0.5) * 0.08; // gentle wave
    const noise = Math.round(base * seasonalFactor);
    return {w:`W${i+1}`, v:Math.max(2, base + noise)};
  });
}

// Export helpers
function exportCSV(data:Record<string,unknown>[], filename:string){
  if(!data.length)return;
  const keys=Object.keys(data[0]);
  const rows=[keys.join(','),...data.map(r=>keys.map(k=>JSON.stringify(r[k]??'')).join(','))];
  const blob=new Blob([rows.join('\n')],{type:'text/csv'});
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=filename+'.csv';a.click();
}

export default function DashboardPage(){
  const router=useRouter();
  const [page,setPage]=useState<NavPage>('dashboard');
  const [kpi,setKpi]=useState<KPI|null>(null);
  const [userName,setUserName]=useState('');
  const [givingRange,setGivingRange]=useState('6m');
  const [cellRange,setCellRange]=useState('8w');
  const [selectedCell,setSelectedCell]=useState<typeof CELLS_DATA[0]|null>(null);
  const [cellFilter,setCellFilter]=useState<string>('all');
  const [memberSearch,setMemberSearch]=useState('');
  const [memberFilter,setMemberFilter]=useState('all');
  const [attDrill,setAttDrill]=useState<string|null>(null);
  const [selectedDept,setSelectedDept]=useState<typeof DEPTS[0]|null>(null);
  const [chatOpen,setChatOpen]=useState(false);
  const [chatInput,setChatInput]=useState('');
  const [selectedAgent,setSelectedAgent]=useState<AgentName>('moshe');
  const [messages,setMessages]=useState<ChatMessage[]>([{role:'agent',agent:'Moshe',text:'Good day, Pastor. I am Moshe — your church intelligence assistant. Ask me about attendance, giving, members, cell performance, or budget planning. I can also answer general questions.'}]);
  const [chatLoading,setChatLoading]=useState(false);
  const chatEndRef=useRef<HTMLDivElement>(null);
  const [goals,setGoals]=useState({q3:1250,dec:1400});
  const [dark,setDark]=useState(false);
  const [sidebarOpen,setSidebarOpen]=useState(false);
  const [isMobile,setIsMobile]=useState(false);
  const [dbCells,setDbCells]=useState<typeof CELLS_DATA|null>(null);
  const [editGoals,setEditGoals]=useState(false);
  const [liveFeed,setLiveFeed]=useState<{id:string;cell:string;fellowship:string;present:number;absent:number;visitors:number;mins_ago:number}[]>([]);
  const [livePresent,setLivePresent]=useState<number|null>(null);
  const [liveCellsReported,setLiveCellsReported]=useState<number|null>(null);

  useEffect(()=>{
    const checkMobile=()=>setIsMobile(window.innerWidth<768);
    checkMobile();
    window.addEventListener('resize',checkMobile);
    return()=>window.removeEventListener('resize',checkMobile);
  },[]);

  useEffect(()=>{
    fetch('/api/auth/me',{credentials:'include'}).then(r=>r.json()).then(({data})=>{
      if(data?.name&&data.name!=='General')setUserName(data.name);
      else if(data?.email)setUserName(data.email.split('@')[0]);
    }).catch(()=>{});
    fetch('/api/analytics/dashboard',{credentials:'include'}).then(r=>r.json()).then(({data})=>{if(data)setKpi(data);}).catch(()=>{});

    // Live feed - fetch real submissions and auto-refresh every 30s
    function fetchLive(){
      fetch('/api/analytics/live',{credentials:'include'}).then(r=>r.json()).then(({data})=>{
        if(data){
          setLiveFeed(data.feed||[]);
          setLivePresent(data.today_present);
          setLiveCellsReported(data.cells_reported);
        }
      }).catch(()=>{});
    }
    fetchLive();
    const interval=setInterval(fetchLive,30000);

    // Load real cell data with actual leaders
    fetch('/api/cells/all',{credentials:'include'}).then(r=>r.json()).then(({data})=>{
      if(data?.cells&&data.cells.length>0) setDbCells(data.cells);
    }).catch(()=>{});

    return()=>clearInterval(interval);
  },[]);

  useEffect(()=>{chatEndRef.current?.scrollIntoView({behavior:'smooth'});},[messages]);

  const sendChat=useCallback(async()=>{
    if(!chatInput.trim()||chatLoading)return;
    const query=chatInput.trim();setChatInput('');
    setMessages(m=>[...m,{role:'user',text:query},{role:'agent',agent:selectedAgent,text:'',loading:true}]);
    setChatLoading(true);
    try{
      const res=await fetch('/api/ai/query',{method:'POST',headers:{'Content-Type':'application/json'},credentials:'include',body:JSON.stringify({query,agent:selectedAgent,history:messages.filter(m=>!m.loading&&m.text&&m.text.trim()!=="").map(m=>({role:m.role==="user"?"user":"assistant",content:m.text}))})});
      if(!res.ok){const e=await res.json();setMessages(m=>{const u=[...m];u[u.length-1]={role:'agent',agent:selectedAgent,text:e?.error?.message||'Request failed.',loading:false};return u;});setChatLoading(false);return;}
      const reader=res.body?.getReader();const decoder=new TextDecoder();let full='';let lbl=selectedAgent.charAt(0).toUpperCase()+selectedAgent.slice(1);
      while(reader){const{done,value}=await reader.read();if(done)break;
        for(const line of decoder.decode(value).split(String.fromCharCode(10)).filter(l=>l.startsWith('data: '))){
          const raw=line.slice(6);if(raw==='[DONE]')break;
          try{const p=JSON.parse(raw);
            if(p.text){full+=p.text;setMessages(m=>{const u=[...m];u[u.length-1]={role:'agent',agent:lbl,text:full,loading:false};return u;});}
            if(p.meta?.agent)lbl={moshe:'Moshe',ktava:'Ktava',arkwind:'ArkMind',numbers:'NUMB3RS1.2'}[p.meta.agent as string]||p.meta.agent;
            if(p.error)setMessages(m=>{const u=[...m];u[u.length-1]={role:'agent',agent:lbl,text:`Error: ${p.error}`,loading:false};return u;});
          }catch{}}}
    }catch{setMessages(m=>{const u=[...m];u[u.length-1]={role:'agent',agent:selectedAgent,text:'Network error. Please try again.',loading:false};return u;});}
    setChatLoading(false);
  },[chatInput,chatLoading,selectedAgent]);

  function logout(){fetch('/api/auth/logout',{method:'POST',credentials:'include'}).catch(()=>{});document.cookie='shepherd_token=; Max-Age=0; path=/';router.push('/login');}

  // Theme - true black/white
  const t = {
    bg:        dark?'#0A0A0A':'#F9FAFB',
    card:      dark?'#141414':'#FFFFFF',
    border:    dark?'#2A2A2A':'#E5E7EB',
    text:      dark?'#FFFFFF':'#111827',
    sub:       dark?'#AAAAAA':'#6B7280',
    muted:     dark?'#666666':'#9CA3AF',
    nav:       dark?'#0A0A0A':'#FFFFFF',
    navBorder: dark?'#2A2A2A':'#E5E7EB',
    hover:     dark?'#1F1F1F':'#F9FAFB',
    input:     dark?'#1F1F1F':'#F9FAFB',
    tableRow:  dark?'#141414':'#F9FAFB',
    cardInner: dark?'#1F1F1F':'#F9FAFB',
    purple:    dark?'#A89FFF':'#534AB7',
    purpleBg:  dark?'#1A1A2E':'#EEEDFE',
    teal:      dark?'#2DD4AA':'#1D9E75',
    tealBg:    dark?'#0D2620':'#E1F5EE',
    amber:     dark?'#FCD34D':'#BA7517',
    amberBg:   dark?'#1F1A00':'#FAEEDA',
    coral:     dark?'#F87171':'#D85A30',
    coralBg:   dark?'#1F0A0A':'#FAECE7',
    chartGrid: dark?'#2A2A2A':'#F0F0F0',
    chartAxis: dark?'#666666':'#6B7280',
    chartTip:  dark?'#141414':'#FFFFFF',
    chartTipText: dark?'#FFFFFF':'#374151',
    chartBorder: dark?'#2A2A2A':'#E5E7EB',
  };
  const card=(e?:React.CSSProperties):React.CSSProperties=>({background:t.card,border:`0.5px solid ${t.border}`,borderRadius:10,padding:'16px 20px',...e});
  const bc=(b:string)=>b==='teal'?{bg:'#E1F5EE',c:'#085041'}:b==='amber'?{bg:'#FAEEDA',c:'#633806'}:{bg:'#EEEDFE',c:'#3C3489'};
  const ss=(s:string)=>s==='rising'?{bg:'#E1F5EE',c:'#085041'}:s==='stable'?{bg:'#F3F4F6',c:'#374151'}:s==='watch'?{bg:'#FAEEDA',c:'#633806'}:{bg:'#FAECE7',c:'#993C1D'};

  const navItems=[
    {id:'dashboard' as NavPage,icon:'',label:'Dashboard'},
    {id:'members' as NavPage,icon:'',label:'Members'},
    {id:'departments' as NavPage,icon:'',label:'Departments'},
    {id:'attendance' as NavPage,icon:'',label:'Attendance'},
    {id:'giving' as NavPage,icon:'',label:'Giving'},
    {id:'cells' as NavPage,icon:'',label:'Cell Ministry'},
    {id:'reports' as NavPage,icon:'',label:'Reports'},
  ];

  const agentOpts=[
    {id:'moshe' as AgentName,label:'Moshe',desc:'Strategy & all domains'},
    {id:'ktava' as AgentName,label:'Ktava',desc:'Attendance records'},
    {id:'arkwind' as AgentName,label:'ArkMind',desc:'Giving & financials'},
    {id:'numbers' as AgentName,label:'NUMB3RS1.2',desc:'Census & demographics'},
  ];

  const rangeOpts:TimeRange[]=['8w','3m','6m','1y','2y','5y'];
  const rangeLabel=(r:TimeRange)=>r==='8w'?'8 Weeks':r==='3m'?'3 Months':r==='6m'?'6 Months':r==='1y'?'1 Year':r==='2y'?'2 Years':'5 Years';

  return(
    <div style={{display:'flex',minHeight:'100vh',background:t.bg,fontFamily:'Inter,system-ui,sans-serif'}}>
      {/* Sidebar overlay for mobile */}
      {isMobile&&sidebarOpen&&<div onClick={()=>setSidebarOpen(false)} style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.3)',zIndex:40}}/>}
      {/* Sidebar */}
      <div style={{width:220,background:t.nav,borderRight:`0.5px solid ${t.navBorder}`,display:'flex',flexDirection:'column',position:isMobile?'fixed':'sticky',top:0,left:isMobile?(sidebarOpen?0:-196):0,height:'100vh',flexShrink:0,zIndex:50,transition:'left 0.25s ease'}}>
        <div style={{display:'flex',alignItems:'center',gap:10,padding:'16px 16px 14px',borderBottom:`0.5px solid ${t.navBorder}`}}>
          <div style={{width:32,height:32,background:'linear-gradient(135deg,#534AB7,#7F77DD)',borderRadius:8,display:'flex',alignItems:'center',justifyContent:'center',fontSize:18}}>&#10013;</div>
          <div><div style={{fontSize:13,fontWeight:600,color:t.text}}>SHEP.HERD</div><div style={{fontSize:10,color:t.muted,marginTop:1}}>Comforters House Global</div></div>
        </div>
        <nav style={{flex:1,padding:'8px 0',overflowY:'auto'}}>
          {navItems.map(n=>(
            <button key={n.id} onClick={()=>{setSelectedCell(null);setSelectedDept(null);setPage(n.id);}}
              style={{display:'flex',alignItems:'center',gap:10,width:'100%',padding:'9px 16px',fontSize:13,border:'none',cursor:'pointer',textAlign:'left',background:page===n.id?t.purpleBg:'transparent',color:page===n.id?(dark?'#FFFFFF':'#3C3489'):t.sub,fontWeight:page===n.id?500:400,transition:'background 0.1s'}}>
              {n.label}
            </button>
          ))}
        </nav>
        <div style={{padding:12,borderTop:`0.5px solid ${t.navBorder}`}}>
          <button onClick={()=>setChatOpen(v=>!v)} style={{width:'100%',background:chatOpen?'#534AB7':'#EEEDFE',color:chatOpen?'#fff':'#3C3489',border:'none',borderRadius:8,padding:'8px 12px',fontSize:13,fontWeight:500,cursor:'pointer',display:'flex',alignItems:'center',gap:8}}>
            Ask AI Agents
          </button>
          <button onClick={logout} style={{width:'100%',background:'transparent',color:t.muted,border:'none',borderRadius:8,padding:'6px 12px',fontSize:12,cursor:'pointer',marginTop:4}}>Sign out</button>
        </div>
      </div>

      {/* Main */}
      <div style={{flex:1,display:'flex',flexDirection:'column',minWidth:0}}>
        {/* Topbar */}
        <div style={{background:t.nav,borderBottom:`0.5px solid ${t.navBorder}`,padding:'14px 24px',display:'flex',alignItems:'center',justifyContent:'space-between',position:'sticky',top:0,zIndex:30}}>
          <div style={{display:'flex',alignItems:'center',gap:10}}>
            {isMobile&&<button onClick={()=>setSidebarOpen(v=>!v)} style={{background:'none',border:'none',cursor:'pointer',fontSize:20,color:'#534AB7',padding:'0 4px',lineHeight:1}}>☰</button>}
            <div>
              <span style={{fontSize:14,fontWeight:500,color:t.text}}>{navItems.find(n=>n.id===page)?.label}</span>
              {!isMobile&&<span style={{fontSize:12,color:t.muted,marginLeft:10}}>{new Date().toLocaleDateString('en-GB',{weekday:'long',day:'numeric',month:'long',year:'numeric'})}</span>}
              {userName&&userName!=='General'&&<span style={{fontSize:12,color:'#534AB7',marginLeft:isMobile?6:10}}>· {greeting()}, {userName.split(' ')[0]}</span>}
            </div>
          </div>
          <div style={{display:'flex',alignItems:'center',gap:12}}>
            <button onClick={()=>setDark(v=>!v)} style={{background:t.purpleBg,border:'none',borderRadius:20,padding:'4px 10px',cursor:'pointer',fontSize:12,color:dark?'#A89FFF':'#534AB7',fontWeight:500}}>
              {dark?'● Light Mode':'○ Dark Mode'}
            </button>
            <div style={{display:'flex',alignItems:'center',gap:5,fontSize:12,color:'#1D9E75'}}>
              <span style={{width:7,height:7,borderRadius:'50%',background:'#1D9E75',display:'inline-block'}}/>Live
            </div>
            <div style={{width:32,height:32,borderRadius:'50%',background:'#CECBF6',display:'flex',alignItems:'center',justifyContent:'center',fontSize:12,fontWeight:500,color:'#3C3489'}}>{userName?userName.slice(0,2).toUpperCase():'GO'}</div>
          </div>
        </div>

        <div style={{flex:1,padding:'20px',overflowY:'auto',background:t.bg,maxWidth:'100%'}}>

          {/* ══ DASHBOARD ══ */}
          {page==='dashboard'&&(
            <div>
              <div style={{background:t.tealBg,borderRadius:8,padding:'8px 14px',marginBottom:18,display:'flex',alignItems:'center',gap:8,fontSize:12,color:'#085041'}}>
                <span>●</span>
                <span>Attendance session live &mdash; <strong>{fmt(kpi?.today_present)}</strong> check-ins · <strong>{kpi?.today_cells_reported??'—'}/{kpi?.today_cells_total??'—'}</strong> cells reported</span>
              </div>
              <div style={{display:'grid',gridTemplateColumns:isMobile?'repeat(2,1fr)':'repeat(4,1fr)',gap:10,marginBottom:18}}>
                {[
                  {label:'Total members',value:'1,147',delta:'+23 this month',page:'members' as NavPage},
                  {label:"Today's check-ins",value:fmt(kpi?.today_present),delta:`${kpi?.today_cells_reported??'—'}/${kpi?.today_cells_total??'—'} cells in`,page:'attendance' as NavPage},
                  {label:'YTD giving',value:kpi?fmtNGN(kpi.ytd_giving_ngn):'—',delta:'+12% vs last year',page:'giving' as NavPage},
                  {label:'Active cells',value:fmt(kpi?.active_cells),delta:'3 fellowships',page:'cells' as NavPage},
                ].map(m=>(
                  <div key={m.label} onClick={()=>setPage(m.page)} style={{...card(),cursor:'pointer'}}
                    onMouseEnter={e=>e.currentTarget.style.boxShadow='0 2px 8px rgba(83,74,183,0.15)'}
                    onMouseLeave={e=>e.currentTarget.style.boxShadow='none'}>
                    <div style={{fontSize:11,color:t.sub,marginBottom:4}}>{m.label}</div>
                    <div style={{fontSize:26,fontWeight:600,color:t.text,lineHeight:1.1}}>{m.value}</div>
                    <div style={{fontSize:11,color:'#1D9E75',marginTop:3}}>{m.delta}</div>
                  </div>
                ))}
              </div>
              <div style={{display:'grid',gridTemplateColumns:isMobile?'1fr':'1fr 1fr',gap:14,marginBottom:14}}>
                <div onClick={()=>setPage('attendance')} style={{...card(),cursor:'pointer'}}>
                  <div style={{display:'flex',justifyContent:'space-between',marginBottom:10}}>
                    <span style={{fontSize:13,fontWeight:500,color:t.text}}>Attendance trend (8 Sundays)</span>
                    <span style={{fontSize:12,color:t.purple}}>View all →</span>
                  </div>
                  <ResponsiveContainer width="100%" height={100}>
                    <BarChart data={[{w:'W1',s1:378,s2:241},{w:'W2',s1:391,s2:248},{w:'W3',s1:383,s2:243},{w:'W4',s1:402,s2:256},{w:'W5',s1:418,s2:261},{w:'W6',s1:411,s2:258},{w:'W7',s1:445,s2:278},{w:'W8',s1:458,s2:289}]} margin={{top:2,right:0,left:-30,bottom:0}}>
                      <XAxis dataKey="w" tick={{fontSize:9,fill:t.chartAxis}} tickLine={false} axisLine={false}/>
                      <YAxis hide/><Tooltip contentStyle={{fontSize:11,borderRadius:6,border:'1px solid #e5e7eb'}}/>
                      <Bar dataKey="s1" name="Svc 1" fill="#534AB7" radius={[2,2,0,0]}/>
                      <Bar dataKey="s2" name="Svc 2" fill="#AFA9EC" radius={[2,2,0,0]}/>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div style={card()}>
                  <div style={{display:'flex',justifyContent:'space-between',marginBottom:10}}>
                    <span style={{fontSize:13,fontWeight:500,color:t.text}}>Recent activity</span>
                    <span style={{fontSize:12,color:t.purple,cursor:'pointer'}} onClick={()=>setPage('attendance')}>View log</span>
                  </div>
                  {liveFeed.length>0?liveFeed.slice(0,6).map((r,i)=>(
                    <div key={r.id} style={{display:'flex',alignItems:'flex-start',gap:10,padding:'7px 0',borderBottom:i<Math.min(liveFeed.length,6)-1?`0.5px solid ${t.navBorder}`:'none'}}>
                      <div style={{width:8,height:8,borderRadius:'50%',background:i===0?'#1D9E75':i%3===1?'#BA7517':'#534AB7',marginTop:4,flexShrink:0}}/>
                      <div>
                        <div style={{fontSize:12,color:t.text}}>{r.cell} &mdash; <strong>{r.present}</strong> present{r.visitors>0?`, ${r.visitors} visitors`:''}</div>
                        <div style={{fontSize:11,color:t.muted,marginTop:1}}>{r.mins_ago<1?'just now':r.mins_ago<60?`${r.mins_ago}m ago`:`${Math.floor(r.mins_ago/60)}h ago`} · {r.fellowship}</div>
                      </div>
                    </div>
                  )):(
                    <div style={{fontSize:12,color:t.muted,padding:'12px 0',textAlign:'center'}}>No submissions yet today</div>
                  )}
                </div>
              </div>
              <div style={{display:'grid',gridTemplateColumns:isMobile?'1fr':'1fr 1fr 1fr',gap:14}}>
                <div onClick={()=>setPage('departments')} style={{...card(),cursor:'pointer'}}>
                  <div style={{display:'flex',justifyContent:'space-between',marginBottom:12}}><span style={{fontSize:13,fontWeight:500,color:t.text}}>Top departments</span><span style={{fontSize:12,color:t.purple}}>View all →</span></div>
                  {DEPTS.slice(0,5).map(d=>{const b=bc(d.badge);return(
                    <div key={d.name} style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8,fontSize:12}}>
                      <span style={{color:dark?'#E5E7EB':'#374151'}}>{d.name}</span>
                      <span style={{background:b.bg,color:b.c,fontSize:11,padding:'2px 8px',borderRadius:10}}>{d.count} members</span>
                    </div>
                  );})}
                </div>
                <div onClick={()=>setPage('giving')} style={{...card(),cursor:'pointer'}}>
                  <div style={{display:'flex',justifyContent:'space-between',marginBottom:8}}><span style={{fontSize:13,fontWeight:500,color:t.text}}>Giving breakdown</span><span style={{fontSize:12,color:t.purple}}>Drill down →</span></div>
                  <div style={{display:'flex',alignItems:'center',gap:10}}>
                    <ResponsiveContainer width={80} height={80}>
                      <PieChart><Pie data={GIVING_PIE} cx={35} cy={35} innerRadius={20} outerRadius={35} dataKey="value" stroke="none">{GIVING_PIE.map((e,i)=><Cell key={i} fill={e.color}/>)}</Pie></PieChart>
                    </ResponsiveContainer>
                    <div style={{flex:1}}>{GIVING_PIE.map(g=>(
                      <div key={g.name} style={{display:'flex',alignItems:'center',gap:5,marginBottom:4,fontSize:11}}>
                        <div style={{width:8,height:8,borderRadius:2,background:g.color,flexShrink:0}}/>
                        <span style={{color:dark?'#E5E7EB':'#374151',flex:1}}>{g.name}</span>
                        <span style={{color:t.sub,fontWeight:500}}>{g.value}%</span>
                      </div>
                    ))}</div>
                  </div>
                </div>
                <div onClick={()=>setPage('cells')} style={{...card(),cursor:'pointer'}}>
                  <div style={{display:'flex',justifyContent:'space-between',marginBottom:10}}><span style={{fontSize:13,fontWeight:500,color:t.text}}>Cell alerts</span><span style={{fontSize:12,color:t.purple}}>View all →</span></div>
                  {(dbCells||CELLS_DATA).filter(c=>c.status==='alert'||c.status==='watch').slice(0,3).map(c=>(
                    <div key={c.cell} style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
                      <div><div style={{fontSize:12,color:dark?'#E5E7EB':'#374151',fontWeight:500}}>{c.cell}</div><div style={{fontSize:11,color:t.muted}}>{c.fel}</div></div>
                      <span style={{fontSize:11,padding:'2px 8px',borderRadius:10,fontWeight:500,background:ss(c.status).bg,color:ss(c.status).c}}>{c.trend}</span>
                    </div>
                  ))}
                  <div style={{fontSize:11,color:'#1D9E75',marginTop:4}}>✓ {(dbCells||CELLS_DATA).filter(c=>c.status==='rising').length} cells rising</div>
                </div>
              </div>
              {/* Membership Goals */}
              <div style={{marginTop:14,...card()}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
                  <div>
                    <div style={{fontSize:13,fontWeight:500,color:t.text}}>Membership Growth Goals</div>
                    <div style={{fontSize:11,color:t.muted,marginTop:2}}>Current: 1,147 members</div>
                  </div>
                  <button onClick={()=>setEditGoals(v=>!v)} style={{background:'#EEEDFE',color:'#3C3489',border:'none',borderRadius:8,padding:'5px 12px',fontSize:12,cursor:'pointer',fontWeight:500}}>
                    {editGoals?'Save':'Set Goals'}
                  </button>
                </div>
                <div style={{display:'grid',gridTemplateColumns:isMobile?'1fr':'1fr 1fr',gap:14}}>
                  {[
                    {label:'Q3 Target (Sep 2026)',key:'q3' as const,color:'#534AB7',bg:'#EEEDFE'},
                    {label:'Year-End Target (Dec 2026)',key:'dec' as const,color:'#1D9E75',bg:'#E1F5EE'},
                  ].map(g=>{
                    const current=1147;
                    const pct=Math.min(100,Math.round((current/goals[g.key])*100));
                    const remaining=Math.max(0,goals[g.key]-current);
                    return(
                      <div key={g.key} style={{background:g.bg,borderRadius:10,padding:'14px 16px'}}>
                        <div style={{fontSize:11,color:g.color,fontWeight:500,marginBottom:6}}>{g.label}</div>
                        {editGoals?(
                          <input type="number" value={goals[g.key]}
                            onChange={e=>setGoals(v=>({...v,[g.key]:parseInt(e.target.value)||0}))}
                            style={{fontSize:20,fontWeight:600,color:g.color,background:'transparent',border:'none',borderBottom:`1px solid ${g.color}`,outline:'none',width:'100%',marginBottom:8}}/>
                        ):(
                          <div style={{fontSize:24,fontWeight:600,color:g.color,marginBottom:6}}>{goals[g.key].toLocaleString()}</div>
                        )}
                        <div style={{height:8,background:'rgba(255,255,255,0.5)',borderRadius:4,overflow:'hidden',marginBottom:6}}>
                          <div style={{height:'100%',width:`${pct}%`,background:g.color,borderRadius:4,transition:'width 0.5s'}}/>
                        </div>
                        <div style={{display:'flex',justifyContent:'space-between',fontSize:11}}>
                          <span style={{color:g.color,fontWeight:500}}>{pct}% there</span>
                          <span style={{color:g.color}}>{remaining.toLocaleString()} to go</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* ══ ATTENDANCE ══ */}
          {page==='attendance'&&(
            <div style={{display:'flex',flexDirection:'column',gap:14}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                <div className="range-btns">
                  {rangeOpts.map(r=>(
                    <button key={r} onClick={()=>setCellRange(r)}
                      style={{padding:'5px 12px',borderRadius:20,border:'0.5px solid',cursor:'pointer',fontSize:12,fontWeight:cellRange===r?500:400,background:cellRange===r?'#534AB7':t.cardInner,borderColor:cellRange===r?'#534AB7':'#E5E7EB',color:cellRange===r?'#fff':t.sub}}>
                      {rangeLabel(r)}
                    </button>
                  ))}
                </div>
                <button onClick={()=>exportCSV(cellTrend(CELLS_DATA[0],cellRange).map(d=>({Week:d.w,Service1:d.v,Service2:Math.floor(d.v*0.63)})),'attendance_export')}
                  style={{background:'#EEEDFE',color:'#3C3489',border:'none',borderRadius:8,padding:'6px 12px',fontSize:12,cursor:'pointer',fontWeight:500}}>⬇ Export CSV</button>
              </div>
              <div style={card()}>
                <div style={{fontSize:13,fontWeight:500,marginBottom:4}}>Overall Attendance Trend</div>
                <div style={{fontSize:11,color:t.muted,marginBottom:12}}>All fellowships combined · {rangeLabel(cellRange as TimeRange)}</div>
                <ResponsiveContainer width="100%" height={240}>
                  <LineChart data={cellTrend(CELLS_DATA[3],cellRange)} margin={{top:5,right:10,left:-20,bottom:0}}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0"/>
                    <XAxis dataKey="w" tick={{fontSize:9,fill:t.chartAxis}} interval={Math.floor(cellTrend(CELLS_DATA[0],cellRange).length/8)}/>
                    <YAxis tick={{fontSize:10,fill:t.chartAxis}} domain={['auto','auto']}/>
                    <Tooltip contentStyle={{fontSize:12,borderRadius:8,border:'1px solid #e5e7eb',background:t.chartTip,color:t.chartTipText}}/>
                    <Line type="monotone" dataKey="v" name="Attendance" stroke="#534AB7" strokeWidth={2} dot={false}/>
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <div style={{display:'grid',gridTemplateColumns:isMobile?'1fr':'repeat(3,1fr)',gap:12}}>
                {[{name:'Youth Fellowship',cells:12,avg:347,trend:'+8%',s1:198,s2:124,absent:25},{name:'Women Fellowship',cells:15,avg:289,trend:'+5%',s1:164,s2:103,absent:22},{name:'Men Fellowship',cells:8,avg:198,trend:'+11%',s1:112,s2:71,absent:15}].map(f=>(
                  <div key={f.name} onClick={()=>setAttDrill(attDrill===f.name?null:f.name)} style={{...card(),cursor:'pointer',border:attDrill===f.name?'0.5px solid #534AB7':`0.5px solid ${t.border}`}}>
                    <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
                      <div style={{fontSize:11,color:t.sub,marginBottom:4}}>{f.name}</div>
                      <span style={{fontSize:10,color:'#534AB7'}}>{attDrill===f.name?'▲':'▼'} drill</span>
                    </div>
                    <div style={{fontSize:22,fontWeight:500,color:t.text}}>{f.avg}</div>
                    <div style={{display:'flex',justifyContent:'space-between',marginTop:4}}>
                      <span style={{fontSize:11,color:t.muted}}>{f.cells} cells</span>
                      <span style={{fontSize:11,color:'#1D9E75',fontWeight:500}}>{f.trend}</span>
                    </div>
                    {attDrill===f.name&&(
                      <div style={{marginTop:12,paddingTop:10,borderTop:`0.5px solid ${t.navBorder}`}}>
                        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:6,marginBottom:8}}>
                          {[{l:'Service 1',v:f.s1},{l:'Service 2',v:f.s2},{l:'Absent',v:f.absent}].map(s=>(
                            <div key={s.l} style={{background:t.cardInner,borderRadius:6,padding:'6px 8px',textAlign:'center'}}>
                              <div style={{fontSize:16,fontWeight:500,color:s.l==='Absent'?'#D85A30':'#374151'}}>{s.v}</div>
                              <div style={{fontSize:10,color:t.muted}}>{s.l}</div>
                            </div>
                          ))}
                        </div>
                        <div style={{fontSize:11,color:t.sub}}>Click Cell Ministry tab to see per-cell breakdown</div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <div style={card()}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
                  <div style={{fontSize:13,fontWeight:500,color:t.text}}>CYDF - Children & Youth Development Fellowship</div>
                  <span style={{fontSize:11,background:'#EEEDFE',color:'#3C3489',padding:'2px 8px',borderRadius:10}}>300 total</span>
                </div>
                <div style={{display:'grid',gridTemplateColumns:isMobile?'1fr':'1fr 1fr',gap:12,marginBottom:12}}>
                  <div style={{background:t.purpleBg,borderRadius:8,padding:'14px'}}>
                    <div style={{fontSize:11,color:'#534AB7',marginBottom:6,fontWeight:500}}>Children (Ages 0–12)</div>
                    <div style={{fontSize:28,fontWeight:600,color:t.text,color:'#3C3489',marginBottom:4}}>180</div>
                    <div style={{fontSize:11,color:'#7F77DD',marginBottom:8}}>Tracked in demographic profile only</div>
                    <div style={{display:'flex',flexDirection:'column',gap:4}}>
                      {[{label:'Boys',value:94},{label:'Girls',value:86},{label:'Under 5',value:42},{label:'Ages 6–12',value:138}].map(s=>(
                        <div key={s.label} style={{display:'flex',justifyContent:'space-between',fontSize:11}}>
                          <span style={{color:'#7F77DD'}}>{s.label}</span>
                          <span style={{fontWeight:500,color:'#3C3489'}}>{s.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div style={{background:t.tealBg,borderRadius:8,padding:'14px'}}>
                    <div style={{fontSize:11,color:'#0F6E56',marginBottom:6,fontWeight:500}}>Teenagers (Ages 13–17)</div>
                    <div style={{fontSize:28,fontWeight:600,color:t.text,color:'#085041',marginBottom:4}}>120</div>
                    <div style={{fontSize:11,color:'#1D9E75',marginBottom:8}}>Sunday fellowship attendance tracked</div>
                    <div style={{display:'flex',flexDirection:'column',gap:4}}>
                      {[{label:'Male',value:61},{label:'Female',value:59},{label:'Last Sunday',value:98},{label:'Avg Attendance',value:'82%'}].map(s=>(
                        <div key={s.label} style={{display:'flex',justifyContent:'space-between',fontSize:11}}>
                          <span style={{color:'#1D9E75'}}>{s.label}</span>
                          <span style={{fontWeight:500,color:'#085041'}}>{s.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                <div style={{background:t.cardInner,borderRadius:8,padding:'10px 12px',fontSize:12,color:t.sub}}>
                  Note: Children are tracked under their parents cell. Teenagers attend the dedicated Sunday Youth Fellowship. Neither group is included in the 1,147 active adult member count.
                </div>
              </div>
              <div style={card()}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
                  <div style={{fontSize:13,fontWeight:500,color:t.text}}>Absentee Report - Last Sunday</div>
                  <button onClick={()=>exportCSV([{Member:'Bro. Ikenna Obi',Cell:'Peace Cell',Fellowship:'Women',LeaderInformed:'Yes'},{Member:'Sis. Chidinma Eze',Cell:'Tabernacle Cell',Fellowship:'Women',LeaderInformed:'No'}],'absentees_export')}
                    style={{background:'#EEEDFE',color:'#3C3489',border:'none',borderRadius:8,padding:'4px 10px',fontSize:11,cursor:'pointer'}}>⬇ Export</button>
                </div>
                <table style={{width:'100%',fontSize:12,borderCollapse:'collapse'}}>
                  <thead><tr style={{borderBottom:`0.5px solid ${t.navBorder}`}}>{['Member','Cell','Fellowship','Leader Informed'].map(h=><th key={h} style={{textAlign:'left',padding:'6px 8px',fontSize:11,fontWeight:500,color:t.sub,textTransform:'uppercase',letterSpacing:'0.05em'}}>{h}</th>)}</tr></thead>
                  <tbody>
                    {[{name:'Bro. Ikenna Obi',cell:'Peace Cell',fel:'Women',inf:'Yes'},{name:'Sis. Chidinma Eze',cell:'Tabernacle Cell',fel:'Women',inf:'No'},{name:'Bro. Uche Nwosu',cell:'Burning Bush Cell',fel:'Youth',inf:'Yes'},{name:'Sis. Ada Okafor',cell:'Graceland Cell',fel:'Women',inf:'No'},{name:'Bro. Emeka Chukwu',cell:'Dominion Cell',fel:'Men',inf:'Yes'}].map(r=>(
                      <tr key={r.name} style={{borderBottom:`0.5px solid ${t.border}`}}>
                        <td style={{padding:'8px 8px',fontWeight:500,color:dark?'#E5E7EB':'#374151'}}>{r.name}</td>
                        <td style={{padding:'8px 8px',color:t.sub}}>{r.cell}</td>
                        <td style={{padding:'8px 8px',color:t.sub}}>{r.fel}</td>
                        <td style={{padding:'8px 8px'}}><span style={{fontSize:11,padding:'2px 8px',borderRadius:10,background:r.inf==='Yes'?'#E1F5EE':'#FAECE7',color:r.inf==='Yes'?'#085041':'#993C1D'}}>{r.inf}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ══ GIVING ══ */}
          {page==='giving'&&(
            <div style={{display:'flex',flexDirection:'column',gap:14}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                <div style={{display:'flex',gap:6}}>
                  {['6m','1y','2y','5y'].map(r=>(
                    <button key={r} onClick={()=>setGivingRange(r)}
                      style={{padding:'5px 12px',borderRadius:20,border:'0.5px solid',cursor:'pointer',fontSize:12,fontWeight:givingRange===r?500:400,background:givingRange===r?'#534AB7':t.cardInner,borderColor:givingRange===r?'#534AB7':'#E5E7EB',color:givingRange===r?'#fff':t.sub}}>
                      {r==='6m'?'6 Months':r==='1y'?'1 Year':r==='2y'?'2 Years':'5 Years'}
                    </button>
                  ))}
                </div>
                <button onClick={()=>exportCSV(givingSlice(givingRange).map(d=>({Period:d.p,Tithe:d.t,Offering:d.o,Special:d.s,Total:d.t+d.o+d.s})),'giving_export')}
                  style={{background:'#EEEDFE',color:'#3C3489',border:'none',borderRadius:8,padding:'6px 12px',fontSize:12,cursor:'pointer',fontWeight:500}}>⬇ Export CSV</button>
              </div>
              <div style={card()}>
                <div style={{fontSize:13,fontWeight:500,marginBottom:4}}>Monthly Giving - The Comforters House Global</div>
                <div style={{fontSize:11,color:t.muted,marginBottom:8}}>{givingSlice(givingRange).length} months · Tithe, Offering & Special</div>
                {/* Legend */}
                <div style={{display:'flex',gap:14,marginBottom:12,flexWrap:'wrap'}}>
                  {[{color:'#534AB7',label:'Tithe'},{color:'#1D9E75',label:'Offering'},{color:'#BA7517',label:'Special'}].map(l=>(
                    <div key={l.label} style={{display:'flex',alignItems:'center',gap:5,fontSize:12}}>
                      <div style={{width:10,height:10,borderRadius:2,background:l.color,flexShrink:0}}/>
                      <span style={{color:dark?'#E5E7EB':'#374151'}}>{l.label}</span>
                    </div>
                  ))}
                </div>
                {/* Scrollable chart container on mobile */}
                <div style={{overflowX:'auto',WebkitOverflowScrolling:'touch',background:t.card}}>
                  <div style={{minWidth: givingSlice(givingRange).length > 6 ? Math.max(givingSlice(givingRange).length * 52, 320) : '100%'}}>
                    <BarChart width={Math.max(givingSlice(givingRange).length * 52, isMobile?320:600)} height={240} data={givingSlice(givingRange)} margin={{top:5,right:10,left:10,bottom:0}}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0"/>
                      <XAxis dataKey="p" tick={{fontSize:9,fill:t.chartAxis}} interval={0} angle={givingSlice(givingRange).length>8?-35:0} textAnchor={givingSlice(givingRange).length>8?'end':'middle'} height={givingSlice(givingRange).length>8?40:20}/>
                      <YAxis tick={{fontSize:9,fill:t.chartAxis}} tickFormatter={v=>`₦${(v/1000000).toFixed(1)}M`} width={45}/>
                      <Tooltip contentStyle={{fontSize:11,borderRadius:8,border:'1px solid #e5e7eb',background:t.chartTip,color:t.chartTipText}} formatter={(v:number,n:string)=>[fmtNGN(v),n==='t'?'Tithe':n==='o'?'Offering':'Special']}/>
                      <Bar dataKey="t" name="Tithe" fill="#534AB7" radius={[2,2,0,0]}/>
                      <Bar dataKey="o" name="Offering" fill="#1D9E75" radius={[2,2,0,0]}/>
                      <Bar dataKey="s" name="Special" fill="#BA7517" radius={[2,2,0,0]}/>
                    </BarChart>
                  </div>
                </div>
                <div style={{fontSize:10,color:t.muted,textAlign:'center',marginTop:4}}>← Swipe to see more →</div>
              </div>
              <div style={{display:'grid',gridTemplateColumns:isMobile?'repeat(2,1fr)':'repeat(4,1fr)',gap:10}}>
                {[{label:'YTD Tithe',value:'₦7.82M'},{label:'YTD Offering',value:'₦5.56M'},{label:'YTD Special',value:'₦613k'},{label:'Per Member (avg)',value:'₦12.2k'},{label:'Best Month',value:'Dec 2025'},{label:'5-Year Growth',value:'+129%'},{label:'Tithe %',value:'75%'},{label:'Dec 25 Peak',value:'₦3.75M'}].map(s=>(
                  <div key={s.label} style={card({padding:'10px 12px'})}>
                    <div style={{fontSize:10,color:t.sub,marginBottom:3}}>{s.label}</div>
                    <div style={{fontSize:16,fontWeight:600,color:t.text}}>{s.value}</div>
                  </div>
                ))}
              </div>
              <div style={card()}>
                <div style={{fontSize:13,fontWeight:500,marginBottom:16}}>Giving Breakdown by Type</div>
                <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:16}}>
                  <PieChart width={220} height={220}>
                    <Pie data={GIVING_PIE} cx={105} cy={105} outerRadius={90} innerRadius={40} dataKey="value" stroke="none">
                      {GIVING_PIE.map((e,i)=><Cell key={i} fill={e.color}/>)}
                    </Pie>
                    <Tooltip contentStyle={{fontSize:11,borderRadius:8,border:'1px solid #e5e7eb',background:t.chartTip,color:t.chartTipText}} formatter={(v:number,n:string)=>[`${v}%`,n]}/>
                  </PieChart>
                  <div style={{width:'100%'}}>
                    {GIVING_PIE.map(g=>(
                      <div key={g.name} style={{marginBottom:12}}>
                        <div style={{display:'flex',justifyContent:'space-between',fontSize:13,marginBottom:4}}>
                          <div style={{display:'flex',alignItems:'center',gap:8}}>
                            <div style={{width:12,height:12,borderRadius:3,background:g.color,flexShrink:0}}/>
                            <span style={{color:dark?'#E5E7EB':'#374151',fontWeight:500}}>{g.name}</span>
                          </div>
                          <span style={{color:dark?'#E5E7EB':'#374151',fontWeight:600}}>{g.value}%</span>
                        </div>
                        <div style={{height:8,background:dark?'#1A1740':'#F3F4F6',borderRadius:4,overflow:'hidden'}}>
                          <div style={{height:'100%',width:`${g.value}%`,background:g.color,borderRadius:4}}/>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ══ MEMBERS ══ */}
          {page==='members'&&(
            <div style={{display:'flex',flexDirection:'column',gap:14}}>
              <div style={{display:'grid',gridTemplateColumns:isMobile?'repeat(2,1fr)':'repeat(4,1fr)',gap:10}}>
                {[
                  {label:'Total Members',value:'1,147',sub:'All statuses'},
                  {label:'Active Members',value:'1,089',sub:'Regularly attending'},
                  {label:'New This Month',value:'23',sub:'June 2026'},
                  {label:'CYDF Combined',value:'300',sub:'180 children · 120 teens'},
                ].map(s=>(
                  <div key={s.label} style={card()}>
                    <div style={{fontSize:11,color:t.sub,marginBottom:4}}>{s.label}</div>
                    <div style={{fontSize:22,fontWeight:500,color:t.text}}>{s.value}</div>
                    <div style={{fontSize:11,color:t.muted,marginTop:2}}>{s.sub}</div>
                  </div>
                ))}
              </div>
              <div style={{display:'grid',gridTemplateColumns:isMobile?'1fr':'1fr 1fr',gap:14}}>
                <div style={card()}>
                  <div style={{fontSize:13,fontWeight:500,marginBottom:12}}>Member Growth - 2026</div>
                  <ResponsiveContainer width="100%" height={160}>
                    <LineChart data={[{m:'Jan',n:1040},{m:'Feb',n:1058},{m:'Mar',n:1075},{m:'Apr',n:1098},{m:'May',n:1124},{m:'Jun',n:1147}]} margin={{top:5,right:10,left:-20,bottom:0}}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0"/>
                      <XAxis dataKey="m" tick={{fontSize:11,fill:t.chartAxis}}/><YAxis tick={{fontSize:10,fill:t.chartAxis}} domain={[1000,1200]}/>
                      <Tooltip contentStyle={{fontSize:12,borderRadius:8,border:'1px solid #e5e7eb',background:t.chartTip,color:t.chartTipText}}/>
                      <Line type="monotone" dataKey="n" name="Members" stroke="#534AB7" strokeWidth={2} dot={{fill:'#534AB7',r:3}}/>
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                <div style={card()}>
                  <div style={{fontSize:13,fontWeight:500,marginBottom:12}}>Conversion Sources</div>
                  {[{src:'Cell outreach',n:312,p:27},{src:'Walk-in',n:298,p:26},{src:'Referral',n:241,p:21},{src:'Crusade',n:195,p:17},{src:'Online',n:101,p:9}].map(s=>(
                    <div key={s.src} style={{marginBottom:8}}>
                      <div style={{display:'flex',justifyContent:'space-between',fontSize:12,marginBottom:3}}>
                        <span style={{color:dark?'#E5E7EB':'#374151'}}>{s.src}</span><span style={{color:t.sub}}>{s.n} ({s.p}%)</span>
                      </div>
                      <div style={{height:6,background:dark?'#1A1740':'#F3F4F6',borderRadius:3,overflow:'hidden'}}><div style={{height:'100%',width:`${s.p}%`,background:'#534AB7',borderRadius:3}}/></div>
                    </div>
                  ))}
                </div>
              </div>
              <div style={{display:'grid',gridTemplateColumns:isMobile?'1fr':'1fr 1fr',gap:14}}>
                <div style={card()}>
                  <div style={{fontSize:13,fontWeight:500,marginBottom:12}}>Gender Distribution</div>
                  <div style={{display:'flex',alignItems:'center',gap:16}}>
                    <ResponsiveContainer width={120} height={120}>
                      <PieChart><Pie data={[{name:'Male',value:48,color:'#534AB7'},{name:'Female',value:52,color:'#1D9E75'}]} cx={55} cy={55} outerRadius={50} dataKey="value" stroke="none">{[{color:'#534AB7'},{color:'#1D9E75'}].map((e,i)=><Cell key={i} fill={e.color}/>)}</Pie></PieChart>
                    </ResponsiveContainer>
                    <div>
                      {[{label:'Male (18+)',value:'551 members',p:'48%',c:'#534AB7'},{label:'Female (18+)',value:'596 members',p:'52%',c:'#1D9E75'},{label:'Children (0–12)',value:'180',p:'',c:'#BA7517'},{label:'Teenagers (13–17)',value:'120',p:'',c:'#D85A30'}].map(g=>(
                        <div key={g.label} style={{display:'flex',alignItems:'center',gap:8,marginBottom:7,fontSize:12}}>
                          <div style={{width:10,height:10,borderRadius:2,background:g.c,flexShrink:0}}/>
                          <span style={{color:dark?'#E5E7EB':'#374151',flex:1}}>{g.label}</span>
                          <span style={{fontWeight:500,color:dark?'#E5E7EB':'#374151'}}>{g.value} {g.p&&<span style={{color:t.muted,fontWeight:400}}>({g.p})</span>}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                <div style={card()}>
                  <div style={{fontSize:13,fontWeight:500,marginBottom:12}}>Age Band Distribution</div>
                  {[{band:'18–25',n:355,p:31},{band:'26–35',n:321,p:28},{band:'36–50',n:275,p:24},{band:'51+',n:195,p:17}].map(a=>(
                    <div key={a.band} style={{marginBottom:10}}>
                      <div style={{display:'flex',justifyContent:'space-between',fontSize:12,marginBottom:3}}>
                        <span style={{color:dark?'#E5E7EB':'#374151'}}>{a.band} years</span><span style={{color:t.sub}}>{a.n} members ({a.p}%)</span>
                      </div>
                      <div style={{height:8,background:dark?'#1A1740':'#F3F4F6',borderRadius:4,overflow:'hidden'}}><div style={{height:'100%',width:`${a.p}%`,background:'linear-gradient(90deg,#534AB7,#7F77DD)',borderRadius:4}}/></div>
                    </div>
                  ))}
                </div>
              </div>
              <div style={card()}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
                  <div style={{fontSize:13,fontWeight:500,color:t.text}}>Recent Additions</div>
                  <button onClick={()=>exportCSV(NEW_MEMBERS,'new_members_export')} style={{background:'#EEEDFE',color:'#3C3489',border:'none',borderRadius:8,padding:'4px 10px',fontSize:11,cursor:'pointer'}}>⬇ Export CSV</button>
                </div>
                <div style={{overflowX:'auto'}}>
                  <table style={{width:'100%',fontSize:12,borderCollapse:'collapse'}}>
                    <thead><tr style={{borderBottom:`0.5px solid ${t.navBorder}`}}>{['Name','Phone','Date Joined','Cell','Fellowship','Care Personnel','Status','How They Came'].map(h=><th key={h} style={{textAlign:'left',padding:'6px 8px',fontSize:10,fontWeight:500,color:t.sub,textTransform:'uppercase',letterSpacing:'0.05em',whiteSpace:'nowrap'}}>{h}</th>)}</tr></thead>
                    <tbody>
                      {NEW_MEMBERS.map(m=>(
                        <tr key={m.name} style={{borderBottom:`0.5px solid ${t.border}`}}>
                          <td style={{padding:'8px 8px',fontWeight:500,color:dark?'#E5E7EB':'#374151',whiteSpace:'nowrap'}}>{m.name}</td>
                          <td style={{padding:'8px 8px',color:t.sub,whiteSpace:'nowrap'}}>{m.phone}</td>
                          <td style={{padding:'8px 8px',color:t.sub,whiteSpace:'nowrap'}}>{m.date}</td>
                          <td style={{padding:'8px 8px',color:t.sub,whiteSpace:'nowrap'}}>{m.cell}</td>
                          <td style={{padding:'8px 8px',color:t.sub,whiteSpace:'nowrap'}}>{m.fellowship}</td>
                          <td style={{padding:'8px 8px',color:dark?'#E5E7EB':'#374151',whiteSpace:'nowrap'}}>{m.care}</td>
                          <td style={{padding:'8px 8px'}}><span style={{fontSize:11,padding:'2px 8px',borderRadius:10,background:m.status==='Staying'?'#E1F5EE':'#FAEEDA',color:m.status==='Staying'?'#085041':'#633806',whiteSpace:'nowrap'}}>{m.status}</span></td>
                          <td style={{padding:'8px 8px',color:t.sub,whiteSpace:'nowrap'}}>{m.invited}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Full Member Database */}
              <div style={card()}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
                  <div style={{fontSize:13,fontWeight:500,color:t.text}}>Full Member Database — 1,147 members</div>
                  <button onClick={()=>exportCSV(ALL_MEMBERS,'full_member_database')} style={{background:'#EEEDFE',color:'#3C3489',border:'none',borderRadius:8,padding:'4px 10px',fontSize:11,cursor:'pointer'}}>⬇ Export All</button>
                </div>
                <div style={{display:'flex',gap:8,marginBottom:12,flexWrap:'wrap'}}>
                  <input value={memberSearch} onChange={e=>setMemberSearch(e.target.value)} placeholder="Search by name..." style={{border:`0.5px solid ${t.border}`,borderRadius:8,padding:'6px 10px',fontSize:12,outline:'none',flex:1,minWidth:160,background:t.input,color:t.text}}/>
                  {['all','Youth','Women','Men','Active','Inactive'].map(f=>(
                    <button key={f} onClick={()=>setMemberFilter(f)}
                      style={{padding:'5px 10px',borderRadius:20,border:'0.5px solid',cursor:'pointer',fontSize:11,fontWeight:memberFilter===f?500:400,background:memberFilter===f?'#534AB7':t.cardInner,borderColor:memberFilter===f?'#534AB7':'#E5E7EB',color:memberFilter===f?'#fff':'#6B7280'}}>
                      {f==='all'?'All':f}
                    </button>
                  ))}
                </div>
                <div style={{overflowX:'auto',maxHeight:400,overflowY:'auto'}}>
                  <table style={{width:'100%',fontSize:12,borderCollapse:'collapse'}}>
                    <thead style={{position:'sticky',top:0,background:t.card}}>
                      <tr style={{borderBottom:`0.5px solid ${t.navBorder}`}}>
                        {['Name','Phone','Cell','Fellowship','Joined','Status','Gender','Age'].map(h=>(
                          <th key={h} style={{textAlign:'left',padding:'6px 8px',fontSize:10,fontWeight:500,color:t.sub,textTransform:'uppercase',letterSpacing:'0.05em',whiteSpace:'nowrap',background:t.card}}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {ALL_MEMBERS
                        .filter(m=>memberSearch?m.name.toLowerCase().includes(memberSearch.toLowerCase()):true)
                        .filter(m=>memberFilter==='all'?true:m.fellowship===memberFilter||m.status===memberFilter)
                        .map((m,i)=>(
                        <tr key={i} style={{borderBottom:`0.5px solid ${t.border}`}}>
                          <td style={{padding:'7px 8px',fontWeight:500,color:dark?'#E5E7EB':'#374151',whiteSpace:'nowrap'}}>{m.name}</td>
                          <td style={{padding:'7px 8px',color:t.sub,whiteSpace:'nowrap'}}>{m.phone}</td>
                          <td style={{padding:'7px 8px',color:t.sub,whiteSpace:'nowrap'}}>{m.cell}</td>
                          <td style={{padding:'7px 8px',color:t.sub,whiteSpace:'nowrap'}}>{m.fellowship}</td>
                          <td style={{padding:'7px 8px',color:t.sub,whiteSpace:'nowrap'}}>{m.joined}</td>
                          <td style={{padding:'7px 8px'}}><span style={{fontSize:11,padding:'2px 8px',borderRadius:10,background:m.status==='Active'?'#E1F5EE':'#FAECE7',color:m.status==='Active'?'#085041':'#993C1D'}}>{m.status}</span></td>
                          <td style={{padding:'7px 8px',color:t.sub}}>{m.gender}</td>
                          <td style={{padding:'7px 8px',color:t.sub}}>{m.age}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div style={{fontSize:11,color:t.muted,padding:'8px',textAlign:'center'}}>
                    Showing {ALL_MEMBERS.filter(m=>memberSearch?m.name.toLowerCase().includes(memberSearch.toLowerCase()):true).filter(m=>memberFilter==='all'?true:m.fellowship===memberFilter||m.status===memberFilter).length} of 1,147 members — connect live database for full roster
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ══ DEPARTMENTS ══ */}
          {page==='departments'&&!selectedDept&&(
            <div style={card()}>
              <div style={{fontSize:13,fontWeight:500,marginBottom:14}}>All Departments - click any to expand</div>
              <table style={{width:'100%',fontSize:12,borderCollapse:'collapse'}}>
                <thead><tr style={{borderBottom:`0.5px solid ${t.navBorder}`}}>{['Department','Category','Leader','Members','Absences','Status'].map(h=><th key={h} style={{textAlign:'left',padding:'8px 10px',fontSize:11,fontWeight:500,color:t.sub,textTransform:'uppercase',letterSpacing:'0.05em'}}>{h}</th>)}</tr></thead>
                <tbody>
                  {DEPTS.map(d=>{const b=bc(d.badge);return(
                    <tr key={d.name} onClick={()=>setSelectedDept(d)} style={{borderBottom:`0.5px solid ${t.border}`,cursor:'pointer'}}
                      onMouseEnter={e=>e.currentTarget.style.background=t.hover}
                      onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                      <td style={{padding:'10px 10px',fontWeight:500,color:dark?'#E5E7EB':'#374151'}}>{d.name}</td>
                      <td style={{padding:'10px 10px',color:t.sub}}>{d.cat}</td>
                      <td style={{padding:'10px 10px',color:dark?'#E5E7EB':'#374151'}}>{d.leader}</td>
                      <td style={{padding:'10px 10px',color:dark?'#E5E7EB':'#374151'}}>{d.count}</td>
                      <td style={{padding:'10px 10px'}}>{d.absent>0?<span style={{background:'#FAECE7',color:'#993C1D',fontSize:11,padding:'2px 8px',borderRadius:10}}>{d.absent} absent</span>:<span style={{background:'#E1F5EE',color:'#085041',fontSize:11,padding:'2px 8px',borderRadius:10}}>Full attendance</span>}</td>
                      <td style={{padding:'10px 10px'}}><span style={{background:b.bg,color:b.c,fontSize:11,padding:'2px 8px',borderRadius:10}}>Active</span></td>
                    </tr>
                  );})}
                </tbody>
              </table>
            </div>
          )}
          {page==='departments'&&selectedDept&&(
            <div style={{display:'flex',flexDirection:'column',gap:14}}>
              <button onClick={()=>setSelectedDept(null)} style={{alignSelf:'flex-start',background:'#EEEDFE',color:'#3C3489',border:'none',borderRadius:8,padding:'6px 14px',fontSize:13,cursor:'pointer'}}>← Back to Departments</button>
              <div style={card()}>
                <div style={{fontSize:15,fontWeight:600,color:t.text,marginBottom:2}}>{selectedDept.name}</div>
                <div style={{fontSize:12,color:t.sub,marginBottom:14}}>Category: {selectedDept.cat} · Leader: {selectedDept.leader} · {selectedDept.count} total members · {selectedDept.absent} absent last Sunday</div>
                <div style={{display:'grid',gridTemplateColumns:isMobile?'1fr':'repeat(3,1fr)',gap:10,marginBottom:16}}>
                  {[{label:'Total Members',value:selectedDept.count},{label:'Present Last Sunday',value:selectedDept.count-selectedDept.absent},{label:'Absent',value:selectedDept.absent}].map(s=>(
                    <div key={s.label} style={{background:t.cardInner,borderRadius:8,padding:'10px 12px'}}><div style={{fontSize:10,color:t.sub,marginBottom:3}}>{s.label}</div><div style={{fontSize:20,fontWeight:500,color:t.text}}>{s.value}</div></div>
                  ))}
                </div>
                <div style={{fontSize:12,fontWeight:500,color:dark?'#E5E7EB':'#374151',marginBottom:8}}>Full Member Roster — {selectedDept.count} members</div>
                <div style={{overflowX:'auto'}}>
                <table style={{width:'100%',fontSize:12,borderCollapse:'collapse'}}>
                  <thead><tr style={{borderBottom:`0.5px solid ${t.navBorder}`}}>{['Name','Role','Phone','Last Sunday','Leader Informed'].map(h=><th key={h} style={{textAlign:'left',padding:'6px 8px',fontSize:11,fontWeight:500,color:t.sub,textTransform:'uppercase',letterSpacing:'0.05em',whiteSpace:'nowrap'}}>{h}</th>)}</tr></thead>
                  <tbody>
                    {selectedDept.members.map((m:Record<string,unknown>,i:number)=>{
                      const absent=!m.present;
                      return(
                        <tr key={i} style={{borderBottom:`0.5px solid ${t.border}`}}>
                          <td style={{padding:'7px 8px',fontWeight:500,color:dark?'#E5E7EB':'#374151',whiteSpace:'nowrap'}}>{String(m.name)}</td>
                          <td style={{padding:'7px 8px',color:t.sub,whiteSpace:'nowrap'}}>{String(m.role)}</td>
                          <td style={{padding:'7px 8px',color:t.sub,whiteSpace:'nowrap'}}>{String(m.phone)}</td>
                          <td style={{padding:'7px 8px'}}><span style={{fontSize:11,padding:'2px 8px',borderRadius:10,background:absent?'#FAECE7':'#E1F5EE',color:absent?'#993C1D':'#085041'}}>{absent?'Absent':'Present'}</span></td>
                          <td style={{padding:'7px 8px'}}>{absent?<span style={{fontSize:11,padding:'2px 8px',borderRadius:10,background:m.informed==='Yes'?'#E1F5EE':'#FAECE7',color:m.informed==='Yes'?'#085041':'#993C1D'}}>{String(m.informed||'No')}</span>:<span style={{fontSize:11,color:t.muted}}>N/A</span>}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                </div>
              </div>
            </div>
          )}

          {/* ══ CELLS ══ */}
          {page==='cells'&&!selectedCell&&(
            <div style={{display:'flex',flexDirection:'column',gap:14}}>
              <div style={{display:'grid',gridTemplateColumns:isMobile?'repeat(2,1fr)':'repeat(4,1fr)',gap:10}}>
                {[{label:'Total Active Cells',value:String((dbCells||CELLS_DATA).length)},{label:'Rising',value:String((dbCells||CELLS_DATA).filter(c=>c.status==='rising').length)},{label:'Need Attention',value:String((dbCells||CELLS_DATA).filter(c=>c.status==='alert'||c.status==='watch').length)},{label:'Avg Attendance Rate',value:'78%'}].map(s=>(
                  <div key={s.label} style={card({padding:'10px 12px'})}><div style={{fontSize:11,color:t.sub,marginBottom:3}}>{s.label}</div><div style={{fontSize:20,fontWeight:500,color:t.text}}>{s.value}</div></div>
                ))}
              </div>
              <div style={card()}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10}}>
                  <div style={{fontSize:13,fontWeight:500,color:t.text}}>All 35 Cells - click any cell to drill down</div>
                  <button onClick={()=>exportCSV((dbCells||CELLS_DATA).map(c=>({Cell:c.cell,Fellowship:c.fel,Leader:c.leader,Members:c.members,AvgAttendance:c.avg,Rate:`${c.rate}%`,Trend:c.trend,Status:c.status})),'cells_export')}
                    style={{background:'#EEEDFE',color:'#3C3489',border:'none',borderRadius:8,padding:'5px 10px',fontSize:11,cursor:'pointer'}}>⬇ Export CSV</button>
                </div>
                <div style={{display:'flex',gap:6,marginBottom:12,flexWrap:'wrap'}}>
                  {[{key:'all',label:'All 35'},{key:'rising',label:'Rising'},{key:'stable',label:'Stable'},{key:'watch',label:'Watch'},{key:'alert',label:'Intervention'},{key:'Youth',label:'Youth'},{key:'Women',label:'Women'},{key:'Men',label:'Men'}].map(f=>(
                    <button key={f.key} onClick={()=>setCellFilter(f.key)}
                      style={{padding:'4px 10px',borderRadius:20,border:'0.5px solid',cursor:'pointer',fontSize:11,fontWeight:cellFilter===f.key?500:400,
                        background:cellFilter===f.key?(f.key==='alert'?'#FAECE7':f.key==='watch'?'#FAEEDA':f.key==='rising'?'#E1F5EE':'#EEEDFE'):'transparent',
                        borderColor:cellFilter===f.key?(f.key==='alert'?'#D85A30':f.key==='watch'?'#BA7517':f.key==='rising'?'#1D9E75':'#534AB7'):'#E5E7EB',
                        color:cellFilter===f.key?(f.key==='alert'?'#993C1D':f.key==='watch'?'#633806':f.key==='rising'?'#085041':'#3C3489'):'#6B7280'}}>
                      {f.label}
                      {f.key!=='all'&&f.key!=='Youth'&&f.key!=='Women'&&f.key!=='Men'&&<span style={{marginLeft:4,fontWeight:400}}>({CELLS_DATA.filter(c=>c.status===f.key).length})</span>}
                    </button>
                  ))}
                </div>
                <div className="table-wrap">
                  <table style={{width:'100%',fontSize:12,borderCollapse:'collapse',minWidth:600}}>
                    <thead><tr style={{borderBottom:`0.5px solid ${t.navBorder}`}}>{['Cell','Fellowship','Leader','Members','Avg Att.','Rate','Trend','Status'].map(h=><th key={h} style={{textAlign:'left',padding:'6px 8px',fontSize:10,fontWeight:500,color:t.sub,textTransform:'uppercase',letterSpacing:'0.04em',whiteSpace:'nowrap'}}>{h}</th>)}</tr></thead>
                    <tbody>
                      {(dbCells||CELLS_DATA).filter(row=>cellFilter==='all'||(row.status===cellFilter)||(row.fel===cellFilter)).map((row,i)=>{const s=ss(row.status);return(
                        <tr key={i} onClick={()=>setSelectedCell(row)} style={{borderBottom:`0.5px solid ${t.border}`,cursor:'pointer'}}
                          onMouseEnter={e=>e.currentTarget.style.background=t.hover}
                          onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                          <td style={{padding:'8px 8px',fontWeight:500,color:dark?'#E5E7EB':'#374151',whiteSpace:'nowrap'}}>{row.cell}</td>
                          <td style={{padding:'8px 8px',color:t.sub,whiteSpace:'nowrap'}}>{row.fel}</td>
                          <td style={{padding:'8px 8px',color:dark?'#E5E7EB':'#374151',whiteSpace:'nowrap'}}>{row.leader}</td>
                          <td style={{padding:'8px 8px',color:dark?'#E5E7EB':'#374151'}}>{row.members}</td>
                          <td style={{padding:'8px 8px',color:dark?'#E5E7EB':'#374151'}}>{row.avg}</td>
                          <td style={{padding:'8px 8px',color:row.rate>=100?'#1D9E75':'#D85A30',fontWeight:500}}>{row.rate}%</td>
                          <td style={{padding:'8px 8px',fontWeight:500,color:row.trend.startsWith('+')?'#1D9E75':'#D85A30'}}>{row.trend}</td>
                          <td style={{padding:'8px 8px'}}><span style={{fontSize:11,padding:'2px 8px',borderRadius:10,fontWeight:500,background:s.bg,color:s.c,whiteSpace:'nowrap'}}>{row.status==='alert'?'Intervention':row.status.charAt(0).toUpperCase()+row.status.slice(1)}</span></td>
                        </tr>
                      );})}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
          {page==='cells'&&selectedCell&&(
            <div style={{display:'flex',flexDirection:'column',gap:14}}>
              <button onClick={()=>setSelectedCell(null)} style={{alignSelf:'flex-start',background:'#EEEDFE',color:'#3C3489',border:'none',borderRadius:8,padding:'6px 14px',fontSize:13,cursor:'pointer'}}>← Back to Cells</button>
              <div style={card()}>
                <div style={{fontSize:15,fontWeight:600,color:t.text,marginBottom:2}}>{selectedCell.cell}</div>
                <div style={{fontSize:12,color:t.sub,marginBottom:14}}>Leader: {selectedCell.leader} · {selectedCell.fel} Fellowship · {selectedCell.members} members · Avg: {selectedCell.avg} · Rate: {selectedCell.rate}%</div>
                {!selectedCell.members_list&&<div style={{fontSize:12,color:t.muted,marginBottom:12,padding:'8px 12px',background:t.cardInner,borderRadius:8}}>Connect live database to see individual member roster for this cell.</div>}
                <div style={{display:'flex',gap:6,marginBottom:14}}>
                  {rangeOpts.map(r=>(
                    <button key={r} onClick={()=>setCellRange(r)}
                      style={{padding:'4px 10px',borderRadius:20,border:'0.5px solid',cursor:'pointer',fontSize:11,fontWeight:cellRange===r?500:400,background:cellRange===r?'#534AB7':t.cardInner,borderColor:cellRange===r?'#534AB7':'#E5E7EB',color:cellRange===r?'#fff':t.sub}}>
                      {rangeLabel(r)}
                    </button>
                  ))}
                </div>
                <div style={{overflowX:'auto',WebkitOverflowScrolling:'touch',background:t.card}}>
                  <ResponsiveContainer width="100%" height={200} minWidth={300}>
                    <LineChart data={cellTrend(selectedCell,cellRange)} margin={{top:5,right:10,left:-20,bottom:0}}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0"/>
                      <XAxis dataKey="w" tick={{fontSize:9,fill:t.chartAxis}} interval={Math.floor(cellTrend(selectedCell,cellRange).length/6)}/>
                      <YAxis tick={{fontSize:9,fill:t.chartAxis}} domain={[0,'auto']} width={32}/>
                      <Tooltip contentStyle={{fontSize:11,borderRadius:8,border:'1px solid #e5e7eb',background:t.chartTip,color:t.chartTipText}}/>
                      <Line type="monotone" dataKey="v" name="Attendance" stroke={selectedCell.status==='alert'?'#D85A30':selectedCell.status==='rising'?'#1D9E75':'#534AB7'} strokeWidth={2} dot={false}/>
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
              {(selectedCell.members_list||[]).length>0&&<div style={card()}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
                  <div style={{fontSize:13,fontWeight:500,color:t.text}}>Cell Members - Last Sunday Attendance</div>
                  <button onClick={()=>exportCSV((selectedCell.members_list||[]).map((n,i)=>({Name:n,Status:i<selectedCell.avg?'Present':'Absent',LeaderInformed:i>=selectedCell.avg?(i%2===0?'Yes':'No'):'N/A'})),`${selectedCell.cell.replace(/ /g,'_')}_members`)}
                    style={{background:'#EEEDFE',color:'#3C3489',border:'none',borderRadius:8,padding:'4px 10px',fontSize:11,cursor:'pointer'}}>⬇ Export</button>
                </div>
                <table style={{width:'100%',fontSize:12,borderCollapse:'collapse'}}>
                  <thead><tr style={{borderBottom:`0.5px solid ${t.navBorder}`}}>{['Name','Last Sunday','Leader Informed'].map(h=><th key={h} style={{textAlign:'left',padding:'6px 8px',fontSize:11,fontWeight:500,color:t.sub,textTransform:'uppercase',letterSpacing:'0.05em'}}>{h}</th>)}</tr></thead>
                  <tbody>
                    {(selectedCell.members_list||[]).map((name,i)=>{
                      const total=(selectedCell.members_list||[]).length;
                      // presentCount based on actual avg attendance
                      const presentCount=Math.min(selectedCell.avg, total);
                      // Spread absences: for alert cells absences are clustered (people stopped coming)
                      // For stable/rising cells absences are scattered (random misses)
                      let present=true;
                      if(selectedCell.status==='alert'){
                        // Last N members absent (they dropped off)
                        present = i < presentCount;
                      } else if(selectedCell.status==='watch'){
                        // Every ~5th member absent
                        present = i < presentCount || (i%5!==4);
                        present = i < presentCount;
                      } else {
                        // Randomly scattered absences - every nth
                        const absentCount=total-presentCount;
                        const interval=absentCount>0?Math.floor(total/absentCount):999;
                        present = interval===999 ? true : (i+1)%interval!==0;
                        // Ensure count is right
                        if(i>=presentCount+(total-presentCount)) present=false;
                        present = i<presentCount;
                      }
                      const informed = i%3===0?'Yes':i%3===1?'No':'Yes';
                      return(
                        <tr key={i} style={{borderBottom:`0.5px solid ${t.border}`}}>
                          <td style={{padding:'7px 8px',fontWeight:500,color:dark?'#E5E7EB':'#374151'}}>{name}</td>
                          <td style={{padding:'7px 8px'}}><span style={{fontSize:11,padding:'2px 8px',borderRadius:10,background:present?'#E1F5EE':'#FAECE7',color:present?'#085041':'#993C1D'}}>{present?'Present':'Absent'}</span></td>
                          <td style={{padding:'7px 8px'}}>{!present?<span style={{fontSize:11,padding:'2px 8px',borderRadius:10,background:informed==='Yes'?'#E1F5EE':'#FAECE7',color:informed==='Yes'?'#085041':'#993C1D'}}>{informed}</span>:<span style={{fontSize:11,color:t.muted}}>N/A</span>}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>}
            </div>
          )}

          {/* ══ REPORTS ══ */}
          {page==='reports'&&(
            <div style={{display:'flex',flexDirection:'column',gap:14}}>
              <div style={{background:t.tealBg,border:dark?'0.5px solid #1D9E75':'0.5px solid #9FE1CB',borderRadius:8,padding:'12px 16px',fontSize:13,color:'#085041'}}>
                <strong>Monthly Summary - June 2026:</strong> Membership at 1,147 (+23 this month). YTD giving ₦13.4M (+12% vs 2025). 3 cells flagged. Youth Fellowship leading growth at +8%.
              </div>
              <div style={card()}>
                <div style={{fontSize:13,fontWeight:500,marginBottom:4}}>AI-Powered Reports</div>
                <div style={{fontSize:12,color:t.sub,marginBottom:14}}>Select a prompt to generate a narrative report via Moshe. Add credits at console.anthropic.com if needed.</div>
                <div style={{display:'flex',flexWrap:'wrap',gap:8}}>
                  {['Monthly attendance report for June 2026','YTD giving analysis and projections','Cell performance review with intervention recommendations','Membership growth analysis and conversion trends','Plan a realistic membership budget for all 35 cells based on current trends','Which 3 cells need immediate pastoral intervention and why?'].map(q=>(
                    <button key={q} onClick={()=>{setChatOpen(true);setChatInput(q);}}
                      style={{background:'#EEEDFE',color:'#3C3489',border:'none',borderRadius:8,padding:'8px 14px',fontSize:12,cursor:'pointer',fontWeight:500,textAlign:'left'}}>
                      {q}
                    </button>
                  ))}
                </div>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:10}}>
                {[{label:'Export All Attendance',data:CELLS_DATA.map(c=>({Cell:c.cell,Fellowship:c.fel,Avg:c.avg,Rate:`${c.rate}%`,Trend:c.trend})),file:'full_attendance'},{label:'Export Giving Data',data:GIVING_DATA.map(d=>({Period:d.p,Tithe:d.t,Offering:d.o,Special:d.s})),file:'full_giving'},{label:'Export Member List',data:NEW_MEMBERS,file:'member_list'}].map(e=>(
                  <button key={e.label} onClick={()=>exportCSV(e.data,e.file)}
                    style={{...card(),border:'0.5px solid #534AB7',cursor:'pointer',textAlign:'left'}}>
                    <div style={{fontSize:13,fontWeight:500,color:'#3C3489',marginBottom:2}}>⬇ {e.label}</div>
                    <div style={{fontSize:11,color:t.muted}}>Export as CSV</div>
                  </button>
                ))}
              </div>
            </div>
          )}

        </div>
      </div>

      {/* ══ AI Chatbox ══ */}
      {chatOpen&&(
        <div style={{position:'fixed',bottom:isMobile?0:16,right:isMobile?0:16,width:isMobile?'100%':380,height:isMobile?'85vh':520,background:t.card,borderRadius:isMobile?'14px 14px 0 0':14,border:`0.5px solid ${t.border}`,boxShadow:'0 8px 32px rgba(0,0,0,0.12)',display:'flex',flexDirection:'column',zIndex:50}}>
          <div style={{padding:'12px 16px',borderBottom:`0.5px solid ${t.navBorder}`,display:'flex',alignItems:'center',justifyContent:'space-between'}}>
            <div style={{display:'flex',alignItems:'center',gap:8}}>
              <div style={{width:28,height:28,borderRadius:'50%',background:'#534AB7',display:'flex',alignItems:'center',justifyContent:'center',fontSize:14}}>[AI]</div>
              <div><div style={{fontSize:13,fontWeight:500,color:t.text}}>Church Intelligence</div><div style={{fontSize:10,color:t.muted}}>4 agents · Select below</div></div>
            </div>
            <button onClick={()=>setChatOpen(false)} style={{background:'none',border:'none',fontSize:18,color:t.muted,cursor:'pointer',lineHeight:1}}>×</button>
          </div>
          <div style={{padding:'7px 12px',borderBottom:`0.5px solid ${t.border}`,display:'flex',gap:4,overflowX:'auto'}}>
            {agentOpts.map(a=>(
              <button key={a.id} onClick={()=>setSelectedAgent(a.id)}
                style={{whiteSpace:'nowrap',fontSize:11,padding:'3px 8px',borderRadius:20,border:'0.5px solid',cursor:'pointer',fontWeight:selectedAgent===a.id?500:400,background:selectedAgent===a.id?'#EEEDFE':'transparent',borderColor:selectedAgent===a.id?'#534AB7':t.border,color:selectedAgent===a.id?'#3C3489':'#6B7280'}}>
                {a.label}
              </button>
            ))}
          </div>
          <div style={{flex:1,overflowY:'auto',padding:'12px 14px',display:'flex',flexDirection:'column',gap:10}}>
            {messages.map((msg,i)=>(
              <div key={i} style={{display:'flex',justifyContent:msg.role==='user'?'flex-end':'flex-start'}}>
                <div style={{maxWidth:'85%',borderRadius:10,padding:'8px 12px',fontSize:13,background:msg.role==='user'?'#534AB7':(dark?'#1A1740':'#F9FAFB'),color:msg.role==='user'?'#fff':(dark?'#E5E7EB':'#374151'),border:msg.role==='agent'?`0.5px solid ${t.navBorder}`:'none'}}>
                  {msg.role==='agent'&&msg.agent&&<div style={{fontSize:10,fontWeight:500,color:dark?'#A89FFF':'#534AB7',marginBottom:4,textTransform:'uppercase',letterSpacing:'0.05em'}}>{msg.agent}</div>}
                  {msg.loading?<div style={{display:'flex',gap:4,padding:'2px 0'}}>{[0,150,300].map(d=><div key={d} style={{width:6,height:6,borderRadius:'50%',background:t.sub,animation:`bounce 1s infinite ${d}ms`}}/>)}</div>:<p style={{margin:0,lineHeight:1.6,whiteSpace:'pre-wrap'}}>{msg.text}</p>}
                </div>
              </div>
            ))}
            <div ref={chatEndRef}/>
          </div>
          <div style={{padding:'6px 12px',borderTop:`0.5px solid ${t.border}`,display:'flex',gap:6,overflowX:'auto'}}>
            {['How are you?','Top 3 cells this month','Plan cell budgets','YTD giving summary','Which cells need help?'].map(q=>(
              <button key={q} onClick={()=>setChatInput(q)}
                style={{whiteSpace:'nowrap',fontSize:11,padding:'3px 8px',borderRadius:20,border:`0.5px solid ${t.border}`,background:'transparent',color:t.sub,cursor:'pointer',flexShrink:0}}>
                {q}
              </button>
            ))}
          </div>
          <div style={{padding:'10px 12px',borderTop:`0.5px solid ${t.navBorder}`,display:'flex',gap:8}}>
            <input value={chatInput} onChange={e=>setChatInput(e.target.value)} onKeyDown={e=>e.key==='Enter'&&!e.shiftKey&&sendChat()}
              placeholder={`Ask ${agentOpts.find(a=>a.id===selectedAgent)?.label}...`} disabled={chatLoading}
              style={{flex:1,border:`0.5px solid ${t.border}`,borderRadius:8,padding:'7px 12px',fontSize:13,outline:'none',background:t.input,color:t.text}}/>
            <button onClick={sendChat} disabled={chatLoading||!chatInput.trim()}
              style={{background:'#534AB7',color:'#fff',border:'none',borderRadius:8,padding:'7px 14px',fontSize:13,cursor:'pointer',fontWeight:500,opacity:chatLoading||!chatInput.trim()?0.5:1}}>→</button>
          </div>
        </div>
      )}
      <style>{`
  @keyframes bounce{0%,100%{transform:translateY(0)}50%{transform:translateY(-4px)}}
  @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}
  *{box-sizing:border-box;}
  .grid-4{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;}
  .grid-3{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;}
  .grid-2{display:grid;grid-template-columns:1fr 1fr;gap:14px;}
  .grid-2s{display:grid;grid-template-columns:1fr 1fr;gap:12px;}
  .grid-chart{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:14px;}
  .grid-goals{display:grid;grid-template-columns:1fr 1fr;gap:14px;}
  .cells-stats{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;}
  .dept-stats{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:16px;}
  .giving-stats{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;}
  .table-wrap{overflow-x:auto;-webkit-overflow-scrolling:touch;}
  .range-btns{display:flex;gap:6px;flex-wrap:wrap;}
  .filter-btns{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px;}
  @media(max-width:1024px){
    .grid-4{grid-template-columns:repeat(2,1fr);}
    .grid-3{grid-template-columns:repeat(2,1fr);}
    .giving-stats{grid-template-columns:repeat(2,1fr);}
    .cells-stats{grid-template-columns:repeat(2,1fr);}
  }
  @media(max-width:768px){
    .grid-4{grid-template-columns:repeat(2,1fr);gap:8px;}
    .grid-3{grid-template-columns:1fr;}
    .grid-2{grid-template-columns:1fr;}
    .grid-2s{grid-template-columns:1fr;}
    .grid-chart{grid-template-columns:1fr;}
    .grid-goals{grid-template-columns:1fr;}
    .cells-stats{grid-template-columns:repeat(2,1fr);}
    .dept-stats{grid-template-columns:repeat(2,1fr);}
    .giving-stats{grid-template-columns:repeat(2,1fr);}
  }
  @media(max-width:480px){
    .grid-4{grid-template-columns:repeat(2,1fr);gap:6px;}
    .cells-stats{grid-template-columns:repeat(2,1fr);}
    .giving-stats{grid-template-columns:repeat(2,1fr);}
    .dept-stats{grid-template-columns:1fr;}
    .range-btns button{padding:4px 8px!important;font-size:11px!important;}
    .filter-btns button{padding:3px 7px!important;font-size:10px!important;}
  }
  @media(min-width:1400px){
    .grid-4{gap:16px;}
    .grid-3{gap:16px;}
    .grid-2{gap:16px;}
  }
`}</style>
    </div>
  );
}
