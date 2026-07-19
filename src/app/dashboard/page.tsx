'use client';
import React from 'react';
import NotificationBell from "@/components/NotificationBell";
import PastorAttendance from '@/components/PastorAttendance';
import PastorGiving from '@/components/PastorGiving';
import PastorRequisitions from '@/components/PastorRequisitions';
import FellowshipValidation from '@/components/FellowshipValidation';
import PrayerRequestPanel from '@/components/PrayerRequestPanel';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell
} from 'recharts';

type KPI = { total_members:number; active_members:number; today_present:number; today_cells_reported:number; today_cells_total:number; ytd_giving_ngn:number; active_cells:number; new_members_month:number; };
type ChatMessage = { role:'user'|'agent'; text:string; agent?:string; loading?:boolean; };
type AgentName = 'ktava'|'arkwind'|'moshe'|'numbers';
type NavPage = 'dashboard'|'attendance'|'giving'|'members'|'cells'|'departments'|'reports'|'recognition'|'commendation'|'prayer'|'requisitions'|'validation'|'settings'|'admin'|'subscription';
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

function PrayerRequestDashboard({t,dark}:{t:Record<string,string>;dark:boolean}){
  const [requests,setRequests]=React.useState<{id:string;request:string;requester_name:string;category:string;status:string;submitted_by_role:string;created_at:string}[]>([]);
  const [filter,setFilter]=React.useState('open');
  React.useEffect(()=>{
    fetch(`/api/prayer-requests?status=${filter}`,{credentials:'include'})
      .then(r=>r.json()).then(({data})=>{if(data?.requests)setRequests(data.requests);}).catch(()=>{});
  },[filter]);
  async function markPrayed(id:string){
    await fetch('/api/prayer-requests',{method:'PATCH',headers:{'Content-Type':'application/json'},credentials:'include',body:JSON.stringify({id,status:'prayed'})});
    setRequests(prev=>prev.map(r=>r.id===id?{...r,status:'prayed'}:r));
  }
  const STATUS_CFG:{[k:string]:{bg:string;text:string;label:string}}={
    open:{bg:'#EEEDFE',text:'#3C3489',label:'Open'},
    prayed:{bg:'#E1F5EE',text:'#085041',label:'Prayed'},
    closed:{bg:'#F3F4F6',text:'#6B7280',label:'Closed'},
  };
  const CATS:{[k:string]:string}={general:'General',healing:'Healing',family:'Family',finance:'Finance',guidance:'Guidance',thanksgiving:'Thanksgiving',other:'Other'};
  return(
    <div style={{display:'flex',flexDirection:'column',gap:10}}>
      <div style={{display:'flex',gap:8,marginBottom:4}}>
        {['open','prayed','all'].map(f=>(
          <button key={f} onClick={()=>setFilter(f)}
            style={{padding:'5px 14px',borderRadius:20,border:'none',background:filter===f?'#534AB7':t.input,color:filter===f?'#fff':t.sub,fontSize:11,cursor:'pointer',fontWeight:filter===f?600:400,fontFamily:'inherit'}}>
            {f.charAt(0).toUpperCase()+f.slice(1)}
          </button>
        ))}
        <span style={{marginLeft:'auto',fontSize:11,color:t.muted,alignSelf:'center'}}>{requests.length} request{requests.length!==1?'s':''}</span>
      </div>
      {requests.length===0?(
        <div style={{background:t.card,borderRadius:12,border:`0.5px solid ${t.border}`,padding:40,textAlign:'center'}}>
          <div style={{fontSize:24,marginBottom:8}}>🙏</div>
          <div style={{fontSize:13,color:t.sub}}>No {filter==='all'?'':filter} prayer requests</div>
        </div>
      ):(
        <div style={{background:t.card,borderRadius:12,border:`0.5px solid ${t.border}`,overflow:'hidden'}}>
          {requests.map((r,i)=>{
            const cfg=STATUS_CFG[r.status]||STATUS_CFG.open;
            const daysAgo=Math.floor((Date.now()-new Date(r.created_at).getTime())/86400000);
            return(
              <div key={r.id} style={{padding:'13px 16px',borderBottom:i<requests.length-1?`0.5px solid ${t.border}`:'none'}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:6}}>
                  <div style={{display:'flex',gap:8,alignItems:'center'}}>
                    <span style={{fontSize:12,fontWeight:600,color:t.text}}>{r.requester_name||'Anonymous'}</span>
                    <span style={{fontSize:9,padding:'2px 7px',borderRadius:10,background:t.purpleBg,color:t.purple,fontWeight:500}}>{r.submitted_by_role?.replace('_',' ')}</span>
                    <span style={{fontSize:9,padding:'2px 7px',borderRadius:10,background:t.input,color:t.sub}}>{CATS[r.category]||r.category}</span>
                  </div>
                  <div style={{display:'flex',gap:6,alignItems:'center',flexShrink:0}}>
                    <span style={{fontSize:9,padding:'2px 7px',borderRadius:10,background:cfg.bg,color:cfg.text,fontWeight:500}}>{cfg.label}</span>
                    {r.status==='open'&&(
                      <button onClick={()=>markPrayed(r.id)}
                        style={{fontSize:10,padding:'3px 9px',borderRadius:8,background:t.tealBg,color:t.teal,border:'none',cursor:'pointer',fontWeight:500,fontFamily:'inherit'}}>
                        Mark prayed
                      </button>
                    )}
                  </div>
                </div>
                <div style={{fontSize:12,color:t.sub,lineHeight:1.5,marginBottom:4}}>{r.request}</div>
                <div style={{fontSize:10,color:t.muted}}>{daysAgo===0?'Today':daysAgo===1?'Yesterday':`${daysAgo} days ago`}</div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function SubscriptionPanel({t, dark}: {t: Record<string,string>; dark: boolean}) {
  const [sub, setSub] = React.useState<{
    plan_tier:string; status:string; days_remaining:number;
    trial_ends_at:string; subscription_started_at:string|null; is_active:boolean;
  }|null>(null);
  const [invoices] = React.useState<{id:string;date:string;amount:string;status:string;plan:string}[]>([]);
  // Invoices will populate from Paystack webhooks once payment is configured
  const [loading, setLoading] = React.useState(true);
  const [cancelConfirm, setCancelConfirm] = React.useState(false);
  const [upgrading, setUpgrading] = React.useState<string|null>(null);
  const [toast, setToast] = React.useState('');

  React.useEffect(() => {
    fetch('/api/subscription', { credentials: 'include' })
      .then(r => r.json())
      .then(({ data }) => { if (data) setSub(data); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(''), 4000);
  }

  async function initPaystack(planId: string, amount: number) {
    setUpgrading(planId);
    // Paystack inline checkout - keys will be injected when you add them
    const PAYSTACK_PUBLIC_KEY = process.env.NEXT_PUBLIC_PAYSTACK_KEY || 'pk_live_REPLACE_WITH_YOUR_KEY';
    try {
      // Load Paystack script dynamically
      if (!(window as Window & {PaystackPop?: unknown}).PaystackPop) {
        await new Promise<void>((resolve, reject) => {
          const script = document.createElement('script');
          script.src = 'https://js.paystack.co/v1/inline.js';
          script.onload = () => resolve();
          script.onerror = () => reject();
          document.head.appendChild(script);
        });
      }
      const PaystackPop = (window as Window & {PaystackPop: {setup: (config: Record<string, unknown>) => {openIframe: () => void}}}).PaystackPop;
      const handler = PaystackPop.setup({
        key: PAYSTACK_PUBLIC_KEY,
        email: 'church@shepherd.app', // TODO: replace with actual church email from auth
        amount: amount * 100, // Paystack uses kobo
        currency: 'NGN',
        ref: `SHEP-${planId.toUpperCase()}-${Date.now()}`,
        metadata: { plan_tier: planId, custom_fields: [{ display_name: 'Plan', variable_name: 'plan', value: planId }] },
        callback: async (response: { reference: string }) => {
          // Payment successful - upgrade in our system
          const res = await fetch('/api/subscription', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ plan_tier: planId, paystack_reference: response.reference }),
          });
          if (res.ok) {
            showToast(`Successfully upgraded to ${planId.charAt(0).toUpperCase() + planId.slice(1)} plan!`);
            // Refresh subscription status
            fetch('/api/subscription', { credentials: 'include' })
              .then(r => r.json())
              .then(({ data }) => { if (data) setSub(data); });
          } else {
            showToast('Payment received but activation failed. Contact support@shepherd.app');
          }
          setUpgrading(null);
        },
        onClose: () => { setUpgrading(null); },
      });
      handler.openIframe();
    } catch {
      showToast('Payment system unavailable. Please contact support@shepherd.app to subscribe.');
      setUpgrading(null);
    }
  }

  const PLANS = [
    {
      id: 'starter', name: 'Starter', price: 15000, display: '₦15,000', period: '/month',
      color: '#1D9E75', colorBg: '#E1F5EE', colorBorder: 'rgba(29,158,117,0.2)',
      tagline: 'For small churches getting organised',
      features: ['Up to 500 members', '1 location', 'Up to 20 cells/groups', 'Attendance tracking', 'Member management', 'Basic giving records', 'Email support'],
      limits: ['Moshe AI not included', 'No partnership portal', 'No SMS/WhatsApp alerts'],
    },
    {
      id: 'growth', name: 'Growth', price: 35000, display: '₦35,000', period: '/month',
      color: '#534AB7', colorBg: '#EEEDFE', colorBorder: 'rgba(83,74,183,0.2)',
      tagline: 'Full intelligence for growing churches',
      badge: 'Most popular',
      features: ['Up to 5,000 members', 'Up to 10 locations', 'Unlimited cells/groups', 'Moshe AI agent', 'Partnership portal', 'SMS & WhatsApp alerts', 'Full analytics & reports', 'Priority support', 'Birthday automation', 'Care & follow-up pipeline'],
      limits: [],
    },
    {
      id: 'enterprise', name: 'Enterprise', price: 0, display: 'Custom', period: '',
      color: '#BA7517', colorBg: '#FAEEDA', colorBorder: 'rgba(186,117,23,0.2)',
      tagline: 'For denominations and large multi-site churches',
      features: ['Unlimited members & locations', 'Multi-currency support', 'White-label branding', 'Custom API integrations', 'Dedicated account manager', 'SLA guarantee', 'Onboarding concierge', 'Custom reporting'],
      limits: [],
    },
  ];

  const currentPlan = PLANS.find(p => p.id === sub?.plan_tier);
  const isTrial = sub?.status === 'trial';
  const isActive = sub?.status === 'active';
  const isExpired = sub?.status === 'expired' || (isTrial && (sub?.days_remaining ?? 0) <= 0);

  const cardS = (e?: React.CSSProperties): React.CSSProperties => ({
    background: t.card, border: `0.5px solid ${t.border}`, borderRadius: 12, ...e,
  });

  const labelS: React.CSSProperties = { fontSize: 10, color: t.muted, textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 4, display: 'block' };

  if (loading) return (
    <div style={{display:'flex',alignItems:'center',justifyContent:'center',padding:60,flexDirection:'column',gap:12}}>
      <div style={{width:28,height:28,border:`3px solid ${t.border}`,borderTopColor:t.purple,borderRadius:'50%',animation:'spin 1s linear infinite'}}/>
      <div style={{fontSize:13,color:t.muted}}>Loading subscription…</div>
    </div>
  );

  return (
    <div style={{display:'flex',flexDirection:'column',gap:20, maxWidth: 860}}>

      {/* Toast */}
      {toast && (
        <div style={{background:t.teal,color:'#fff',borderRadius:10,padding:'11px 18px',fontSize:13,fontWeight:500,display:'flex',alignItems:'center',gap:10}}>
          <span>✓</span> {toast}
        </div>
      )}

      {/* Header */}
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
        <div>
          <div style={{fontSize:19,fontWeight:700,color:t.text,letterSpacing:'-0.3px'}}>Subscription & Billing</div>
          <div style={{fontSize:12,color:t.muted,marginTop:3}}>Manage your SHEPHERD plan, payments, and invoices</div>
        </div>
        {isActive && currentPlan && (
          <div style={{textAlign:'right'}}>
            <div style={{fontSize:11,color:t.muted,marginBottom:4}}>Current plan</div>
            <span style={{fontSize:12,fontWeight:700,padding:'4px 14px',borderRadius:20,background:currentPlan.colorBg,color:currentPlan.color}}>
              {currentPlan.name}
            </span>
          </div>
        )}
      </div>

      {/* Status card */}
      <div style={{...cardS({padding:'20px 24px'}),
        background: isExpired ? '#FAECE7' : isTrial ? (sub!.days_remaining <= 7 ? '#FAEEDA' : t.purpleBg) : t.tealBg,
        border: `0.5px solid ${isExpired ? 'rgba(216,90,48,0.2)' : isTrial ? 'rgba(83,74,183,0.2)' : 'rgba(29,158,117,0.2)'}`
      }}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:16,flexWrap:'wrap' as const}}>
          <div style={{flex:1}}>
            <div style={{fontSize:15,fontWeight:700,color:t.text,marginBottom:6}}>
              {isExpired
                ? 'Your trial has ended'
                : isTrial
                ? `Free Trial — ${sub!.days_remaining} day${sub!.days_remaining !== 1 ? 's' : ''} remaining`
                : `${currentPlan?.name || 'Growth'} Plan — Active`}
            </div>
            <div style={{fontSize:13,color:t.sub,lineHeight:1.6,maxWidth:500}}>
              {isExpired
                ? 'Subscribe below to restore full access to SHEPHERD. Your data is safe and will be available immediately upon payment.'
                : isTrial
                ? `You have full Growth plan access during your trial. After ${sub!.days_remaining} days, choose a plan to continue without interruption.`
                : `Your subscription is active. Thank you for using SHEPHERD. Your next renewal is in ${sub!.days_remaining} days.`}
            </div>
            {isTrial && !isExpired && (
              <div style={{marginTop:14}}>
                <div style={{display:'flex',justifyContent:'space-between',marginBottom:6}}>
                  <span style={{fontSize:11,color:t.muted}}>Trial progress</span>
                  <span style={{fontSize:11,color:t.muted}}>{30 - sub!.days_remaining}/30 days used</span>
                </div>
                <div style={{height:6,background:'rgba(83,74,183,0.12)',borderRadius:3,overflow:'hidden'}}>
                  <div style={{height:'100%',width:`${Math.min(100,((30-sub!.days_remaining)/30)*100)}%`,
                    background: sub!.days_remaining <= 7 ? '#D85A30' : sub!.days_remaining <= 14 ? '#BA7517' : '#534AB7',
                    borderRadius:3,transition:'width 0.4s'}}/>
                </div>
              </div>
            )}
          </div>
          <div style={{display:'flex',flexDirection:'column',alignItems:'flex-end',gap:8}}>
            <span style={{fontSize:11,fontWeight:700,padding:'4px 12px',borderRadius:20,
              background: isExpired ? '#D85A30' : isTrial ? '#534AB7' : '#1D9E75',
              color:'#fff'}}>
              {isExpired ? 'EXPIRED' : isTrial ? 'TRIAL' : 'ACTIVE'}
            </span>
            {isActive && (
              <div style={{fontSize:11,color:t.muted,textAlign:'right'}}>
                Renews in {sub!.days_remaining} days
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Plans comparison */}
      <div>
        <div style={{fontSize:14,fontWeight:600,color:t.text,marginBottom:14}}>
          {isActive ? 'Change plan' : 'Choose a plan'}
        </div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:12}}>
          {PLANS.map(plan => {
            const isCurrent = isActive && sub?.plan_tier === plan.id;
            return (
              <div key={plan.id} style={{...cardS({padding:'18px'}),
                border:`${isCurrent ? '1.5px' : '0.5px'} solid ${isCurrent ? plan.color : t.border}`,
                background: isCurrent ? plan.colorBg : t.card,
                display:'flex',flexDirection:'column',gap:0,position:'relative' as const
              }}>
                {plan.badge && (
                  <div style={{position:'absolute' as const,top:-10,left:16,background:plan.color,color:'#fff',fontSize:10,fontWeight:700,borderRadius:20,padding:'2px 10px'}}>
                    {plan.badge}
                  </div>
                )}

                <div style={{marginBottom:12}}>
                  <div style={{fontSize:14,fontWeight:700,color:t.text,marginBottom:2}}>{plan.name}</div>
                  <div style={{fontSize:11,color:t.muted,marginBottom:10}}>{plan.tagline}</div>
                  <div>
                    <span style={{fontSize:22,fontWeight:800,color:plan.color}}>{plan.display}</span>
                    {plan.period && <span style={{fontSize:12,color:t.muted}}>{plan.period}</span>}
                  </div>
                </div>

                <div style={{flex:1,marginBottom:14}}>
                  {plan.features.map((f,i) => (
                    <div key={i} style={{display:'flex',alignItems:'flex-start',gap:7,marginBottom:6}}>
                      <span style={{color:plan.color,fontSize:11,marginTop:1,flexShrink:0}}>✓</span>
                      <span style={{fontSize:11,color:t.sub,lineHeight:1.4}}>{f}</span>
                    </div>
                  ))}
                  {plan.limits.length > 0 && (
                    <div style={{borderTop:`0.5px solid ${t.border}`,marginTop:10,paddingTop:10}}>
                      {plan.limits.map((l,i) => (
                        <div key={i} style={{display:'flex',alignItems:'flex-start',gap:7,marginBottom:5}}>
                          <span style={{color:t.muted,fontSize:11,marginTop:1,flexShrink:0}}>—</span>
                          <span style={{fontSize:11,color:t.muted,lineHeight:1.4}}>{l}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {isCurrent ? (
                  <div style={{background:plan.colorBg,color:plan.color,borderRadius:8,padding:'9px',fontSize:12,fontWeight:600,textAlign:'center'}}>
                    ✓ Current plan
                  </div>
                ) : plan.id === 'enterprise' ? (
                  <button onClick={() => window.open('mailto:enterprise@shepherd.app?subject=Enterprise Plan - SHEPHERD', '_blank')}
                    style={{background:plan.color,color:'#fff',border:'none',borderRadius:8,padding:'10px',fontSize:12,fontWeight:600,cursor:'pointer',width:'100%'}}>
                    Contact us →
                  </button>
                ) : (
                  <button
                    onClick={() => initPaystack(plan.id, plan.price)}
                    disabled={upgrading === plan.id}
                    style={{background:plan.color,color:'#fff',border:'none',borderRadius:8,padding:'10px',fontSize:12,fontWeight:600,cursor:'pointer',width:'100%',opacity:upgrading===plan.id?0.7:1,display:'flex',alignItems:'center',justifyContent:'center',gap:6}}>
                    {upgrading === plan.id
                      ? <><div style={{width:12,height:12,border:'2px solid rgba(255,255,255,0.4)',borderTopColor:'#fff',borderRadius:'50%',animation:'spin 0.8s linear infinite'}}/> Processing…</>
                      : isTrial || isExpired
                      ? `Subscribe — ${plan.display}/mo`
                      : `Switch to ${plan.name}`
                    }
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Invoice history */}
      {isActive && invoices.length > 0 && (
        <div style={cardS({padding:0,overflow:'hidden'})}>
          <div style={{padding:'14px 18px',borderBottom:`0.5px solid ${t.border}`,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
            <div style={{fontSize:13,fontWeight:600,color:t.text}}>Invoice history</div>
            <div style={{fontSize:11,color:t.muted}}>Powered by Paystack</div>
          </div>
          {invoices.map((inv, i) => (
            <div key={inv.id} style={{padding:'12px 18px',borderBottom:i<invoices.length-1?`0.5px solid ${t.border}`:'none',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
              <div style={{display:'flex',alignItems:'center',gap:14}}>
                <div style={{width:32,height:32,borderRadius:8,background:t.purpleBg,display:'flex',alignItems:'center',justifyContent:'center'}}>
                  <span style={{fontSize:14}}>🧾</span>
                </div>
                <div>
                  <div style={{fontSize:12,fontWeight:500,color:t.text}}>{inv.id} — {inv.plan} Plan</div>
                  <div style={{fontSize:11,color:t.muted}}>{new Date(inv.date).toLocaleDateString('en-GB',{day:'numeric',month:'long',year:'numeric'})}</div>
                </div>
              </div>
              <div style={{display:'flex',alignItems:'center',gap:12}}>
                <span style={{fontSize:13,fontWeight:600,color:t.text}}>{inv.amount}</span>
                <span style={{fontSize:10,padding:'2px 8px',borderRadius:10,fontWeight:600,background:t.tealBg,color:t.teal}}>{inv.status.toUpperCase()}</span>
                <button style={{fontSize:11,color:t.purple,background:'none',border:`0.5px solid ${t.border}`,borderRadius:6,padding:'4px 10px',cursor:'pointer'}}>
                  Download
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Billing & payment */}
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
        <div style={cardS({padding:'18px'})}>
          <div style={{fontSize:13,fontWeight:600,color:t.text,marginBottom:10}}>Payment method</div>
          {isActive ? (
            <div style={{display:'flex',alignItems:'center',gap:12}}>
              <div style={{width:40,height:26,borderRadius:5,background:'#1A1F71',display:'flex',alignItems:'center',justifyContent:'center'}}>
                <span style={{color:'#fff',fontSize:9,fontWeight:800}}>VISA</span>
              </div>
              <div>
                <div style={{fontSize:12,color:t.text,fontWeight:500}}>•••• •••• •••• 4242</div>
                <div style={{fontSize:11,color:t.muted}}>Expires 12/27</div>
              </div>
              <button style={{marginLeft:'auto',fontSize:11,color:t.purple,background:t.purpleBg,border:'none',borderRadius:6,padding:'5px 10px',cursor:'pointer'}}>Update</button>
            </div>
          ) : (
            <div style={{fontSize:12,color:t.muted}}>No payment method on file. Subscribe to add one.</div>
          )}
        </div>

        <div style={cardS({padding:'18px'})}>
          <div style={{fontSize:13,fontWeight:600,color:t.text,marginBottom:10}}>Billing contact</div>
          <div style={{fontSize:12,color:t.sub,marginBottom:8}}>Receipts and invoices are sent to:</div>
          <div style={{fontSize:12,color:t.text,fontWeight:500}}>support@shepherd.app</div>
          <button style={{marginTop:10,fontSize:11,color:t.purple,background:t.purpleBg,border:'none',borderRadius:6,padding:'5px 10px',cursor:'pointer'}}>Update email</button>
        </div>
      </div>

      {/* Paystack info + cancel */}
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
        <div style={{...cardS({padding:'16px 18px'}),background:t.purpleBg,border:`0.5px solid rgba(83,74,183,0.15)`}}>
          <div style={{fontSize:12,fontWeight:600,color:t.purple,marginBottom:6}}>Secure payments via Paystack</div>
          <div style={{fontSize:11,color:t.sub,lineHeight:1.6}}>
            Nigerian bank transfers, Verve cards, Mastercard, Visa, and USSD all supported.
            Transactions are encrypted and PCI DSS compliant.
          </div>
          <div style={{display:'flex',gap:8,marginTop:10}}>
            {['🏦 Bank transfer','💳 Card','📱 USSD'].map((m,i) => (
              <span key={i} style={{fontSize:10,background:'rgba(83,74,183,0.1)',color:t.purple,borderRadius:6,padding:'3px 8px'}}>{m}</span>
            ))}
          </div>
        </div>

        <div style={cardS({padding:'16px 18px'})}>
          <div style={{fontSize:12,fontWeight:600,color:t.text,marginBottom:6}}>Need help?</div>
          <div style={{fontSize:11,color:t.sub,lineHeight:1.6,marginBottom:10}}>
            Billing questions, payment issues, or plan changes — we respond within 2 hours.
          </div>
          <a href="mailto:support@shepherd.app" style={{fontSize:11,color:t.purple,fontWeight:600,textDecoration:'none'}}>
            support@shepherd.app →
          </a>
        </div>
      </div>

      {/* Cancel */}
      {isActive && (
        <div style={cardS({padding:'16px 18px'})}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
            <div>
              <div style={{fontSize:13,fontWeight:600,color:t.text,marginBottom:3}}>Cancel subscription</div>
              <div style={{fontSize:11,color:t.muted}}>Your access continues until the end of your billing period. Data is retained for 90 days.</div>
            </div>
            {cancelConfirm ? (
              <div style={{display:'flex',gap:8}}>
                <button onClick={()=>{ showToast('Cancellation request sent. We will process it within 24 hours.'); setCancelConfirm(false); }}
                  style={{background:'#D85A30',color:'#fff',border:'none',borderRadius:8,padding:'8px 14px',fontSize:12,fontWeight:600,cursor:'pointer'}}>
                  Confirm cancel
                </button>
                <button onClick={()=>setCancelConfirm(false)}
                  style={{background:t.input,color:t.sub,border:`0.5px solid ${t.border}`,borderRadius:8,padding:'8px 14px',fontSize:12,cursor:'pointer'}}>
                  Keep plan
                </button>
              </div>
            ) : (
              <button onClick={()=>setCancelConfirm(true)}
                style={{background:'none',color:'#D85A30',border:'1px solid rgba(216,90,48,0.3)',borderRadius:8,padding:'8px 14px',fontSize:12,fontWeight:500,cursor:'pointer'}}>
                Cancel subscription
              </button>
            )}
          </div>
        </div>
      )}

    </div>
  );
}

function AdminRedirect() {
  const router = require('next/navigation').useRouter();
  require('react').useEffect(() => { router.push('/admin'); }, []);
  return (
    <div style={{display:'flex',alignItems:'center',justifyContent:'center',paddingTop:80,flexDirection:'column',gap:12}}>
      <div style={{width:32,height:32,border:'3px solid rgba(83,74,183,0.2)',borderTopColor:'#534AB7',borderRadius:'50%',animation:'spin 1s linear infinite'}}/>
      <div style={{fontSize:14,color:'#9890C4'}}>Opening Admin Portal…</div>
    </div>
  );
}

function ChurchSettingsPanel({t, dark}: {t: Record<string,string>; dark: boolean}) {
  const [config, setConfig] = React.useState<Record<string,unknown>>({});
  const [saving, setSaving] = React.useState(false);
  const [saved, setSaved] = React.useState(false);
  const [activeTab, setActiveTab] = React.useState<'structure'|'church'|'services'>('structure');

  // Form fields
  const [churchName, setChurchName] = React.useState('');
  const [structureType, setStructureType] = React.useState('cell_church');
  const [tier1Label, setTier1Label] = React.useState('Fellowship');
  const [tier2Label, setTier2Label] = React.useState('Cell');
  const [tier3Label, setTier3Label] = React.useState('');
  const [tier1HeadLabel, setTier1HeadLabel] = React.useState('Fellowship Head');
  const [tier2HeadLabel, setTier2HeadLabel] = React.useState('Cell Leader');
  const [currency, setCurrency] = React.useState('NGN');
  const [country, setCountry] = React.useState('Nigeria');
  const [serviceDays, setServiceDays] = React.useState<string[]>(['Sunday']);

  React.useEffect(() => {
    fetch('/api/subscription',{credentials:'include'})
      .then(r=>r.json()).then(({data})=>{if(data)setSubscription(data);}).catch(()=>{});
    fetch('/api/settings/church-config', { credentials: 'include' })
      .then(r => r.json())
      .then(({ data }) => {
        if (data?.config) {
          const c = data.config;
          setConfig(c);
          setChurchName(c.church_name || '');
          setStructureType(c.structure_type || 'cell_church');
          setTier1Label(c.tier1_label || '');
          setTier2Label(c.tier2_label || '');
          setTier3Label(c.tier3_label || '');
          setTier1HeadLabel(c.tier1_head_label || 'Fellowship Head');
          setTier2HeadLabel(c.tier2_head_label || 'Cell Leader');
          setCurrency(c.currency || 'NGN');
          setCountry(c.country || 'Nigeria');
          setServiceDays(c.service_days || ['Sunday']);
        }
      }).catch(() => {});
  }, []);

  async function save() {
    setSaving(true);
    try {
      await fetch('/api/settings/church-config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          church_name: churchName,
          structure_type: structureType,
          tier1_label: tier1Label || null,
          tier2_label: tier2Label || null,
          tier3_label: tier3Label || null,
          tier1_head_label: tier1HeadLabel,
          tier2_head_label: tier2HeadLabel,
          currency,
          country,
          service_days: serviceDays,
        }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch {}
    setSaving(false);
  }

  const STRUCTURES = [
    { value: 'cell_church', label: '⛪ Cell Church', sub: 'Fellowship → Cell → Member' },
    { value: 'zonal', label: '🗺 Zonal Church', sub: 'Zone → District → Cell → Member' },
    { value: 'campus', label: '🏙 Multi-Campus', sub: 'Campus → Fellowship → Cell → Member' },
    { value: 'department', label: '🏛 Department Church', sub: 'Department → Unit → Member' },
    { value: 'house_network', label: '🏠 House Church Network', sub: 'Network → Home Group → Member' },
    { value: 'single', label: '🤲 Single Congregation', sub: 'Pastor → Member' },
  ];

  const DAYS = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const CURRENCIES = [
    {code:'NGN',label:'₦ Nigerian Naira'},{code:'GHS',label:'GH₵ Ghanaian Cedi'},
    {code:'KES',label:'KSh Kenyan Shilling'},{code:'ZAR',label:'R South African Rand'},
    {code:'USD',label:'$ US Dollar'},{code:'GBP',label:'£ British Pound'},
  ];

  const cardS = (e?: React.CSSProperties): React.CSSProperties => ({
    background: t.card, border: `0.5px solid ${t.border}`, borderRadius: 12, padding: '18px 20px', ...e,
  });

  const inputS: React.CSSProperties = {
    width: '100%', border: `0.5px solid ${t.border}`, borderRadius: 8,
    padding: '9px 12px', fontSize: 13, background: t.input, color: t.text, outline: 'none', fontFamily: 'inherit',
  };

  const labelS: React.CSSProperties = {
    fontSize: 10, color: t.muted, textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 6, display: 'block',
  };

  return (
    <div style={{display:'flex',flexDirection:'column',gap:16}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
        <div>
          <div style={{fontSize:17,fontWeight:700,color:t.text}}>Church Settings</div>
          <div style={{fontSize:12,color:t.muted,marginTop:2}}>Configure your church structure, labels, and preferences</div>
        </div>
        <button onClick={save} disabled={saving}
          style={{background:saved?'#1D9E75':t.purple,color:'#fff',border:'none',borderRadius:9,padding:'9px 20px',fontSize:13,fontWeight:600,cursor:'pointer',transition:'background 0.2s'}}>
          {saving?'Saving…':saved?'✓ Saved':'Save changes'}
        </button>
      </div>

      {/* Tab nav */}
      <div style={{display:'flex',gap:0,borderBottom:`0.5px solid ${t.border}`}}>
        {(['structure','church','services'] as const).map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            style={{padding:'9px 18px',border:'none',borderBottom:`2px solid ${activeTab===tab?t.purple:'transparent'}`,background:activeTab===tab?t.purpleBg:'transparent',fontSize:12,fontWeight:activeTab===tab?600:400,color:activeTab===tab?t.purple:t.muted,cursor:'pointer',textTransform:'capitalize' as const}}>
            {tab === 'structure' ? 'Church Structure' : tab === 'church' ? 'Church Details' : 'Services'}
          </button>
        ))}
      </div>

      {activeTab === 'structure' && (
        <div style={{display:'flex',flexDirection:'column',gap:14}}>
          <div style={cardS()}>
            <div style={{fontSize:13,fontWeight:600,color:t.text,marginBottom:14}}>Structure Model</div>
            <div style={{display:'flex',flexDirection:'column',gap:8}}>
              {STRUCTURES.map(s => (
                <button key={s.value} onClick={() => setStructureType(s.value)}
                  style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'11px 14px',borderRadius:9,border:`0.5px solid ${structureType===s.value?t.purple:t.border}`,background:structureType===s.value?t.purpleBg:t.input,cursor:'pointer',textAlign:'left' as const}}>
                  <div>
                    <div style={{fontSize:13,fontWeight:500,color:t.text}}>{s.label}</div>
                    <div style={{fontSize:11,color:t.muted,marginTop:2}}>{s.sub}</div>
                  </div>
                  {structureType===s.value && <span style={{width:8,height:8,borderRadius:'50%',background:t.purple,flexShrink:0}}/>}
                </button>
              ))}
            </div>
          </div>

          {structureType !== 'single' && (
            <div style={cardS()}>
              <div style={{fontSize:13,fontWeight:600,color:t.text,marginBottom:14}}>Label Customisation</div>
              <div style={{display:'flex',flexDirection:'column',gap:12}}>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
                  <div><label style={labelS}>Tier 1 name</label><input value={tier1Label} onChange={e=>setTier1Label(e.target.value)} placeholder="e.g. Fellowship" style={inputS}/></div>
                  <div><label style={labelS}>Tier 1 leader title</label><input value={tier1HeadLabel} onChange={e=>setTier1HeadLabel(e.target.value)} placeholder="e.g. Fellowship Head" style={inputS}/></div>
                </div>
                {tier2Label && (
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
                    <div><label style={labelS}>Tier 2 name</label><input value={tier2Label} onChange={e=>setTier2Label(e.target.value)} placeholder="e.g. Cell" style={inputS}/></div>
                    <div><label style={labelS}>Tier 2 leader title</label><input value={tier2HeadLabel} onChange={e=>setTier2HeadLabel(e.target.value)} placeholder="e.g. Cell Leader" style={inputS}/></div>
                  </div>
                )}
                {(structureType==='zonal'||structureType==='campus') && (
                  <div><label style={labelS}>Tier 3 name</label><input value={tier3Label} onChange={e=>setTier3Label(e.target.value)} placeholder="e.g. Cell" style={inputS}/></div>
                )}
                <div style={{background:t.purpleBg,borderRadius:8,padding:'10px 14px',fontSize:12,color:t.purple}}>
                  Preview: {[tier1Label,tier2Label,tier3Label].filter(Boolean).join(' → ')} → Member
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'church' && (
        <div style={cardS()}>
          <div style={{display:'flex',flexDirection:'column',gap:14}}>
            <div><label style={labelS}>Church name</label><input value={churchName} onChange={e=>setChurchName(e.target.value)} placeholder="e.g. The Comforters House Global" style={inputS}/></div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
              <div>
                <label style={labelS}>Country</label>
                <select value={country} onChange={e=>setCountry(e.target.value)} style={inputS}>
                  {['Nigeria','Ghana','Kenya','South Africa','Uganda','Tanzania','Rwanda','United Kingdom','United States','Canada','Australia','Other'].map(c=><option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label style={labelS}>Currency</label>
                <select value={currency} onChange={e=>setCurrency(e.target.value)} style={inputS}>
                  {CURRENCIES.map(c=><option key={c.code} value={c.code}>{c.label}</option>)}
                </select>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'services' && (
        <div style={cardS()}>
          <div style={{fontSize:13,fontWeight:600,color:t.text,marginBottom:14}}>Service Days</div>
          <div style={{fontSize:12,color:t.muted,marginBottom:14}}>Select the days your church holds services. These determine attendance submission windows and absence tracking.</div>
          <div style={{display:'flex',gap:8,flexWrap:'wrap' as const}}>
            {DAYS.map(day => (
              <button key={day}
                onClick={() => setServiceDays(prev => prev.includes(day) ? prev.filter(d=>d!==day) : [...prev,day])}
                style={{padding:'8px 16px',borderRadius:20,border:`0.5px solid ${serviceDays.includes(day)?t.purple:t.border}`,background:serviceDays.includes(day)?t.purple:t.input,color:serviceDays.includes(day)?'#fff':t.sub,fontSize:12,fontWeight:serviceDays.includes(day)?600:400,cursor:'pointer'}}>
                {day}
              </button>
            ))}
          </div>
          <div style={{marginTop:16,background:t.purpleBg,borderRadius:8,padding:'10px 14px',fontSize:12,color:t.purple}}>
            Active: {serviceDays.join(', ') || 'None selected'}
          </div>
        </div>
      )}
    </div>
  );
}

function MemberApprovalPanel({t,dark}:{t:Record<string,string>;dark:boolean}) {
  const [additions, setAdditions] = React.useState<{id:string;full_name:string;phone:string;gender:string;date_of_birth:string;join_date:string;status:string;submitted_by:string;created_at:string}[]>([]);
  const [processing, setProcessing] = React.useState<Record<string,boolean>>({});
  const [done, setDone] = React.useState<Record<string,string>>({});

  React.useEffect(() => {
    fetch('/api/update/member-additions', { credentials: 'include' })
      .then(r => r.json())
      .then(({ data }) => { if (data?.additions) setAdditions(data.additions); })
      .catch(() => {});
  }, []);

  async function act(id: string, action: 'approve' | 'reject') {
    setProcessing(p => ({ ...p, [id]: true }));
    try {
      await fetch('/api/update/member-additions', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ id, action }),
      });
      setDone(p => ({ ...p, [id]: action }));
      setAdditions(prev => prev.filter(a => a.id !== id));
    } catch {}
    setProcessing(p => ({ ...p, [id]: false }));
  }

  if (additions.length === 0) return null;

  return (
    <div style={{background:t.card,border:`0.5px solid ${t.border}`,borderRadius:12,padding:'16px 18px',marginBottom:4}}>
      <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:14}}>
        <div style={{fontSize:13,fontWeight:600,color:t.text}}>Pending Member Approvals</div>
        <span style={{fontSize:11,padding:'2px 8px',borderRadius:10,background:'#FAEEDA',color:'#633806',fontWeight:600}}>{additions.length}</span>
      </div>
      {additions.map((a,i) => (
        <div key={a.id} style={{display:'flex',alignItems:'center',gap:10,padding:'10px 0',borderBottom:i<additions.length-1?`0.5px solid ${t.border}`:'none',flexWrap:'wrap'}}>
          <div style={{flex:1,minWidth:140}}>
            <div style={{fontSize:13,fontWeight:500,color:t.text}}>{a.full_name}</div>
            <div style={{fontSize:11,color:t.muted}}>{a.phone||'—'} · {a.gender||'—'} · Joined {a.join_date}</div>
          </div>
          <div style={{display:'flex',gap:6}}>
            {done[a.id] ? (
              <span style={{fontSize:11,padding:'4px 10px',borderRadius:8,background:done[a.id]==='approve'?'#E1F5EE':'#FAECE7',color:done[a.id]==='approve'?'#085041':'#993C1D',fontWeight:500}}>
                {done[a.id]==='approve'?'Approved':'Rejected'}
              </span>
            ) : (
              <>
                <button onClick={()=>act(a.id,'approve')} disabled={processing[a.id]}
                  style={{background:'#1D9E75',color:'#fff',border:'none',borderRadius:7,padding:'5px 12px',fontSize:11,fontWeight:600,cursor:'pointer',opacity:processing[a.id]?0.6:1}}>
                  {processing[a.id]?'…':'Approve'}
                </button>
                <button onClick={()=>act(a.id,'reject')} disabled={processing[a.id]}
                  style={{background:'#FAECE7',color:'#993C1D',border:'none',borderRadius:7,padding:'5px 12px',fontSize:11,fontWeight:600,cursor:'pointer',opacity:processing[a.id]?0.6:1}}>
                  Reject
                </button>
              </>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function DashboardPage(){
  const router=useRouter();
  const [page,setPage]=useState<NavPage>('dashboard');
  const [showAlertOnly,setShowAlertOnly]=useState(false);
  const [churchConfig,setChurchConfig]=React.useState<{tier1_label:string|null;tier2_label:string|null;tier1_head_label:string;tier2_head_label:string;church_name:string;currency:string}>({tier1_label:'Fellowship',tier2_label:'Cell',tier1_head_label:'Fellowship Head',tier2_head_label:'Cell Leader',church_name:'',currency:'NGN'});
  const [subscription,setSubscription]=React.useState<{plan_tier:string;status:string;days_remaining:number;is_active:boolean}|null>(null);
  const [kpi,setKpi]=useState<KPI|null>(null);
  const [userName,setUserName]=useState('');
  const [userRole,setUserRole]=useState('');
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
  const [goals,setGoals]=useState(()=>{
    if(typeof window !== 'undefined'){
      try{
        const saved=localStorage.getItem('shepherd_goals');
        if(saved) return JSON.parse(saved);
      }catch{}
    }
    return {q3:1250,dec:1400};
  });
  const [dark,setDark]=useState(false);
  const [sidebarStyle,setSidebarStyle]=useState<'light'|'dark'>('light');
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
      if(data?.role)setUserRole(data.role);
    }).catch(()=>{});
    // Reload config fresh - especially after onboarding
    const urlParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
    const justOnboarded = urlParams?.get('onboarded') === '1';
    fetch('/api/subscription',{credentials:'include'})
      .then(r=>r.json()).then(({data})=>{if(data)setSubscription(data);}).catch(()=>{});
    fetch('/api/settings/church-config' + (justOnboarded ? '?fresh=1' : ''), {credentials:'include', cache: justOnboarded ? 'no-store' : 'default'})
      .then(r=>r.json()).then(({data})=>{if(data?.config)setChurchConfig(data.config);}).catch(()=>{});
    if (justOnboarded && typeof window !== 'undefined') {
      window.history.replaceState({}, '', '/dashboard');
    }
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
    // Concept C — Deep Dark Glass (dark) / Rich Warm White (light)
    bg:        dark?'#0D0B1E':'#F0EFF8',
    card:      dark?'rgba(255,255,255,0.04)':'#FFFFFF',
    cardSolid: dark?'#13102A':'#FFFFFF',
    border:    dark?'rgba(168,159,255,0.08)':'rgba(83,74,183,0.10)',
    borderMed: dark?'rgba(168,159,255,0.15)':'rgba(83,74,183,0.20)',
    text:      dark?'#E8E5FF':'#1A1040',
    sub:       dark?'rgba(232,229,255,0.55)':'#5A5180',
    muted:     dark?'rgba(232,229,255,0.28)':'#9990CC',
    nav:       dark?'#080618':sidebarStyle==='dark'?'#0D0A24':'#FFFFFF',
    navBorder: dark?'rgba(168,159,255,0.06)':sidebarStyle==='dark'?'rgba(255,255,255,0.07)':'rgba(83,74,183,0.10)',
    hover:     dark?'rgba(168,159,255,0.06)':'rgba(83,74,183,0.04)',
    input:     dark?'rgba(255,255,255,0.05)':'#F7F6FF',
    tableRow:  dark?'rgba(255,255,255,0.02)':'#FAFAFA',
    cardInner: dark?'rgba(255,255,255,0.03)':'#F7F6FF',
    purple:    dark?'#A89FFF':'#534AB7',
    purpleBg:  dark?'rgba(83,74,183,0.25)':'#EEEDFE',
    teal:      dark?'#2DD4AA':'#1D9E75',
    tealBg:    dark?'rgba(29,158,117,0.15)':'#E1F5EE',
    amber:     dark?'#FCD34D':'#BA7517',
    amberBg:   dark?'rgba(186,117,23,0.15)':'#FAEEDA',
    coral:     dark?'#F87171':'#D85A30',
    coralBg:   dark?'rgba(216,90,48,0.15)':'#FAECE7',
    chartGrid: dark?'rgba(168,159,255,0.06)':'#F0EEF9',
    chartAxis: dark?'rgba(168,159,255,0.35)':'#9990CC',
    chartTip:  dark?'#13102A':'#FFFFFF',
    chartTipText: dark?'#E8E5FF':'#1A1040',
    chartBorder: dark?'rgba(168,159,255,0.08)':'rgba(83,74,183,0.10)',
  };
  const card=(e?:React.CSSProperties):React.CSSProperties=>({background:t.card,border:`0.5px solid ${t.border}`,borderRadius:10,padding:'16px 20px',...e});
  const bc=(b:string)=>b==='teal'?{bg:'#E1F5EE',c:'#085041'}:b==='amber'?{bg:'#FAEEDA',c:'#633806'}:{bg:'#EEEDFE',c:'#3C3489'};
  const ss=(s:string)=>s==='rising'?{bg:'#E1F5EE',c:'#085041'}:s==='stable'?{bg:'#F3F4F6',c:'#374151'}:s==='watch'?{bg:'#FAEEDA',c:'#633806'}:{bg:'#FAECE7',c:'#993C1D'};

  const navItems=[
    {id:'dashboard' as NavPage,icon:'ti-layout-dashboard',label:'Dashboard'},
    {id:'members' as NavPage,icon:'ti-users',label:'Members'},
    {id:'departments' as NavPage,icon:'ti-building',label:`${churchConfig.tier1_label?'Fellowships':'Departments'}`},
    {id:'attendance' as NavPage,icon:'ti-calendar-stats',label:'Attendance'},
    {id:'giving' as NavPage,icon:'ti-coin',label:'Giving'},
    {id:'cells' as NavPage,icon:'ti-circles',label:`${churchConfig.tier2_label||'Cell'} Ministry`},
    {id:'reports' as NavPage,icon:'ti-chart-bar',label:'Reports'},
    {id:'recognition' as NavPage,icon:'ti-award',label:'Recognition'},
    {id:'commendation' as NavPage,icon:'ti-star',label:'Commend Leaders'},
    {id:'prayer' as NavPage,icon:'ti-heart',label:'Prayer Requests'},
    {id:'requisitions' as NavPage,icon:'ti-receipt',label:'Requisitions'},
    {id:'validation' as NavPage,icon:'ti-checkbox',label:'Validate Records'},
    {id:'settings' as NavPage,icon:'ti-settings',label:'Settings'},
    {id:'subscription' as NavPage,icon:'ti-credit-card',label:'Subscription'},
    ...(userRole === 'lead_tech' ? [{id:'admin' as NavPage,icon:'ti-shield',label:'Admin Portal'}] : []),
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
    <div data-theme={dark?'dark':'light'} data-sidebar={dark?'dark':sidebarStyle} style={{display:'flex',minHeight:'100vh',background:t.bg,fontFamily:'Inter,system-ui,sans-serif'}}>
      {/* Sidebar overlay for mobile */}
      {isMobile&&sidebarOpen&&<div onClick={()=>setSidebarOpen(false)} style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.3)',zIndex:40}}/>}
      {/* Sidebar */}
      <div style={{width:220,background:t.nav,borderRight:`0.5px solid ${t.navBorder}`,display:'flex',flexDirection:'column',position:isMobile?'fixed':'sticky',top:0,left:isMobile?(sidebarOpen?0:-196):0,height:'100vh',flexShrink:0,zIndex:50,transition:'left 0.3s cubic-bezier(0.4,0,0.2,1)',backdropFilter:'blur(20px)'}}>
        <div style={{display:'flex',alignItems:'center',gap:10,padding:'16px 16px 14px',borderBottom:`0.5px solid ${t.navBorder}`}}>
          <div style={{width:28,height:28,position:'relative',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}><div style={{position:'absolute',width:4,height:20,background:'#A89FFF',borderRadius:2}}/><div style={{position:'absolute',width:15,height:4,background:'#A89FFF',borderRadius:2}}/></div>
          <div><div style={{fontSize:14,fontWeight:700,color:dark?'#E8E5FF':sidebarStyle==='dark'?'#FFFFFF':'#1A1040',letterSpacing:'1px',lineHeight:1}}>SHEP.HERD</div><div style={{fontSize:9,color:dark?'rgba(232,229,255,0.3)':sidebarStyle==='dark'?'rgba(255,255,255,0.35)':'#9990CC',marginTop:2,maxWidth:140,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{churchConfig.church_name || 'Church Intelligence'}</div></div>
        </div>
        <nav style={{flex:1,padding:'8px 0',overflowY:'auto'}}>
          {navItems.map(n=>(
            <button key={n.id} onClick={()=>{setSelectedCell(null);setSelectedDept(null);setPage(n.id);}}
              className="sh-nav-item"
              style={{
                background: page===n.id ? (dark?'rgba(83,74,183,0.45)':'rgba(83,74,183,0.10)') : 'transparent',
                color: page===n.id ? (dark?'#E8E5FF':'#3C3489') : undefined,
                fontWeight: page===n.id ? 600 : 400,
                borderLeft: `2px solid ${page===n.id?'#534AB7':'transparent'}`,
                boxShadow: page===n.id ? (dark?'0 0 20px rgba(83,74,183,0.3), inset 0 0 0 0.5px rgba(168,159,255,0.2)':'0 0 12px rgba(83,74,183,0.10)') : 'none',
                borderRadius: '0 8px 8px 0',
                margin: '1px 8px 1px 0',
                width: 'calc(100% - 8px)',
                transition: 'all 0.2s ease',
              }}>
              {n.icon && <i className={`ti ${n.icon}`} style={{fontSize:15,opacity:page===n.id?1:0.5,flexShrink:0}} aria-hidden="true" />}
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
      <div style={{flex:1,display:'flex',flexDirection:'column',minWidth:0,background:t.bg}}>
        {/* Trial banner */}
        {subscription && subscription.status === 'trial' && (
          <div style={{background: subscription.days_remaining <= 5 ? '#D85A30' : subscription.days_remaining <= 14 ? '#BA7517' : '#534AB7', color:'#fff', padding:'8px 24px', display:'flex', alignItems:'center', justifyContent:'space-between', fontSize:12, fontWeight:500}}>
            <span>{subscription.days_remaining <= 0 ? '⚠ Your trial has expired. Subscribe to continue.' : `⏱ Free trial — ${subscription.days_remaining} day${subscription.days_remaining !== 1 ? 's' : ''} remaining`}</span>
            <button onClick={()=>setPage('subscription')} style={{background:'rgba(255,255,255,0.2)',color:'#fff',border:'1px solid rgba(255,255,255,0.4)',borderRadius:6,padding:'4px 12px',fontSize:11,fontWeight:600,cursor:'pointer'}}>{subscription.days_remaining <= 0 ? 'Subscribe now' : 'View plans'}</button>
          </div>
        )}
        {/* Topbar */}
        <div style={{background:t.nav,borderBottom:`0.5px solid ${t.navBorder}`,padding:'14px 24px',display:'flex',alignItems:'center',justifyContent:'space-between',position:'sticky',top:0,zIndex:30}}>
          <div style={{display:'flex',alignItems:'center',gap:10}}>
            {isMobile&&<button onClick={()=>setSidebarOpen(v=>!v)} style={{background:'none',border:'none',cursor:'pointer',fontSize:20,color:'#534AB7',padding:'0 4px',lineHeight:1}}>☰</button>}
            <div>
              <span style={{fontSize:14,fontWeight:500,color:t.text}}>{navItems.find(n=>n.id===page)?.label}</span>{churchConfig.church_name&&page==='dashboard'&&<span style={{fontSize:11,color:t.muted,marginLeft:8}}>{churchConfig.church_name}</span>}
              {!isMobile&&<span suppressHydrationWarning style={{fontSize:11,color:t.muted,marginLeft:10}}>{new Date().toLocaleDateString('en-GB',{weekday:'long',day:'numeric',month:'long',year:'numeric'})}</span>}
              {userName&&userName!=='General'&&<span style={{fontSize:12,color:'#534AB7',marginLeft:isMobile?6:10}}>· {greeting()}, {userName.split(' ')[0]}</span>}
            </div>
          </div>
          <div style={{display:'flex',alignItems:'center',gap:12}}>
            {!isMobile&&!dark&&(<div style={{display:'flex',background:t.cardInner,border:`0.5px solid ${t.border}`,borderRadius:20,padding:2,gap:2}}><button onClick={()=>setSidebarStyle('light')} style={{padding:'4px 10px',borderRadius:16,fontSize:10,cursor:'pointer',border:'none',background:sidebarStyle==='light'?'#534AB7':'transparent',color:sidebarStyle==='light'?'#fff':t.muted,fontFamily:'inherit'}}>Light sidebar</button><button onClick={()=>setSidebarStyle('dark')} style={{padding:'4px 10px',borderRadius:16,fontSize:10,cursor:'pointer',border:'none',background:sidebarStyle==='dark'?'#534AB7':'transparent',color:sidebarStyle==='dark'?'#fff':t.muted,fontFamily:'inherit'}}>Dark sidebar</button></div>)}
            <button onClick={()=>setPage('members')} style={{display:'flex',alignItems:'center',gap:6,padding:'6px 12px',borderRadius:8,border:`0.5px solid ${t.navBorder}`,background:'transparent',fontSize:11,color:t.sub,cursor:'pointer',fontFamily:'inherit'}}><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>Search</button>
            <button onClick={()=>setPage('members')} style={{display:'flex',alignItems:'center',gap:6,padding:'6px 12px',borderRadius:8,border:'none',background:'#534AB7',color:'#fff',fontSize:11,fontWeight:500,cursor:'pointer',fontFamily:'inherit'}}><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14"/></svg>Add member</button>
            <NotificationBell dark={dark} /><div onClick={()=>setDark(v=>!v)} style={{width:32,height:32,borderRadius:8,border:`0.5px solid ${t.navBorder}`,background:'transparent',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',color:t.sub}}>{dark?<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>:<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>}</div>
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
              {/* Profile completion prompt */}
              {churchConfig.church_name && !churchConfig.church_name.includes('My Church') && (() => {
                const profile = typeof (churchConfig as Record<string,unknown>).church_profile === 'object' ? (churchConfig as Record<string,unknown>).church_profile as Record<string,unknown> : null;
                const isComplete = profile?.contact_email && profile?.address;
                if (isComplete) return null;
                return (
                  <div style={{background:t.amberBg,border:`0.5px solid rgba(186,117,23,0.2)`,borderRadius:9,padding:'10px 16px',marginBottom:16,display:'flex',alignItems:'center',justifyContent:'space-between',gap:12}}>
                    <div style={{fontSize:12,color:t.amber,fontWeight:500}}>
                      📋 Complete your church profile — add contact details, address, and logo so your team can identify you.
                    </div>
                    <button onClick={()=>{setPage('settings');}} style={{background:t.amber,color:'#fff',border:'none',borderRadius:7,padding:'5px 12px',fontSize:11,fontWeight:600,cursor:'pointer',whiteSpace:'nowrap'}}>
                      Complete profile →
                    </button>
                  </div>
                );
              })()}
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
                            onChange={e=>{const updated={...goals,[g.key]:parseInt(e.target.value)||0};setGoals(updated);if(typeof window!=='undefined'){try{localStorage.setItem('shepherd_goals',JSON.stringify(updated));}catch{}}}}
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
            <PastorAttendance dark={dark} t={t} />
          )}          {/* ══ GIVING ══ */}
          {page==='giving'&&(
            <PastorGiving dark={dark} t={t} />
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

              {/* Member Approval Panel - M1 */}
              <MemberApprovalPanel t={t} dark={dark} />

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

          {page==='recognition'&&(
            <div style={{display:'flex',flexDirection:'column',gap:14}}>
              {/* Header */}
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                <div>
                  <div style={{fontSize:15,fontWeight:700,color:t.text}}>Recognition Centre</div>
                  <div style={{fontSize:12,color:t.muted,marginTop:2}}>SLA performance, badges and leaderboards — updated every Monday</div>
                </div>
                <button onClick={() => setShowAlertOnly((v:boolean)=>!v)}
                  style={{background: showAlertOnly ? '#993C1D' : '#FAECE7',color: showAlertOnly ? '#fff' : '#993C1D',border:'0.5px solid rgba(216,90,48,0.2)',borderRadius:8,padding:'7px 14px',fontSize:12,cursor:'pointer',fontWeight:600}}>
                  {showAlertOnly ? '✕ All leaders' : '⚠ Needs Attention'}
                </button>
              </div>

              {/* Performance tiers legend */}
              <div style={{...card(),padding:'12px 16px'}}>
                <div style={{fontSize:11,fontWeight:600,color:t.muted,textTransform:'uppercase',letterSpacing:'0.5px',marginBottom:10}}>Performance tiers</div>
                <div style={{display:'flex',flexWrap:'wrap',gap:8}}>
                  {[
                    {tier:'Crown of Excellence',range:'95–100%',bg:'#FAEEDA',c:'#633806'},
                    {tier:'Elite Shepherd',range:'90–94%',bg:'#EEEDFE',c:'#3C3489'},
                    {tier:'Faithful Steward',range:'75–89%',bg:'#E1F5EE',c:'#085041'},
                    {tier:'Consistent Servant',range:'60–74%',bg:'#F3F4F6',c:'#374151'},
                    {tier:'Needs Improvement',range:'45–59%',bg:'#FAEEDA',c:'#993C1D'},
                    {tier:'Requires Pastoral Review',range:'Below 45%',bg:'#FAECE7',c:'#993C1D'},
                  ].map(t2=>(
                    <div key={t2.tier} style={{background:t2.bg,borderRadius:8,padding:'6px 12px',fontSize:11}}>
                      <span style={{color:t2.c,fontWeight:600}}>{t2.tier}</span>
                      <span style={{color:t2.c,opacity:0.7,marginLeft:6}}>{t2.range}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Top Cell Leaders */}
              <div style={card()}>
                <div style={{fontSize:13,fontWeight:600,color:t.text,marginBottom:14}}>Top Cell Leaders</div>
                <div style={{overflowX:'auto'}}>
                  <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
                    <thead>
                      <tr style={{borderBottom:`0.5px solid ${t.border}`}}>
                        {['Rank','Leader','Cell','Fellowship','SLA Score','Attendance','Growth','Accuracy','Overall','Tier','Badges'].map(h=>(
                          <th key={h} style={{textAlign:'left',padding:'8px 10px',fontSize:10,color:t.muted,fontWeight:500,textTransform:'uppercase',letterSpacing:'0.4px',whiteSpace:'nowrap'}}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {(showAlertOnly
                        ? CELLS_DATA.filter(c=>c.status==='alert'||c.status==='watch')
                        : [...CELLS_DATA].sort((a,b)=>{
                            const score=(x:typeof CELLS_DATA[0])=>x.status==='rising'?92:x.status==='stable'?78:x.status==='watch'?55:35;
                            return score(b)-score(a);
                          }).slice(0,15)
                      ).map((c,i)=>{
                        const slaScore=c.status==='rising'?92:c.status==='stable'?78:c.status==='watch'?61:45;
                        const tier=slaScore>=95?'Crown of Excellence':slaScore>=90?'Elite Shepherd':slaScore>=75?'Faithful Steward':slaScore>=60?'Consistent Servant':'Needs Improvement';
                        const tierColor=slaScore>=90?{bg:'#EEEDFE',c:'#3C3489'}:slaScore>=75?{bg:'#E1F5EE',c:'#085041'}:slaScore>=60?{bg:'#F3F4F6',c:'#374151'}:{bg:'#FAEEDA',c:'#993C1D'};
                        return(
                          <tr key={c.cell} style={{borderBottom:`0.5px solid ${t.border}`}}>
                            <td style={{padding:'10px 10px',fontWeight:700,color:i===0?'#BA7517':i===1?t.muted:t.sub}}>{i+1}</td>
                            <td style={{padding:'10px 10px',fontWeight:500,color:t.text,whiteSpace:'nowrap'}}>{c.leader}</td>
                            <td style={{padding:'10px 10px',color:t.sub,whiteSpace:'nowrap'}}>{c.cell}</td>
                            <td style={{padding:'10px 10px',color:t.sub}}>{c.fel}</td>
                            <td style={{padding:'10px 10px',fontWeight:600,color:slaScore>=75?t.teal:t.coral}}>{slaScore}%</td>
                            <td style={{padding:'10px 10px',color:t.text}}>{c.rate}%</td>
                            <td style={{padding:'10px 10px',color:c.trend.startsWith('+')?t.teal:t.coral,fontWeight:500}}>{c.trend}</td>
                            <td style={{padding:'10px 10px',color:t.teal}}>98%</td>
                            <td style={{padding:'10px 10px',fontWeight:700,color:slaScore>=75?t.teal:t.coral}}>{Math.round((slaScore*0.4)+(c.rate*0.3)+(80*0.2)+(98*0.1))}%</td>
                            <td style={{padding:'10px 10px'}}><span style={{fontSize:10,padding:'2px 8px',borderRadius:10,background:tierColor.bg,color:tierColor.c,fontWeight:500,whiteSpace:'nowrap'}}>{tier}</span></td>
                            <td style={{padding:'10px 10px'}}>
                              <div style={{display:'flex',gap:4}}>
                                {slaScore>=90&&<span title="Unbroken — 12 consecutive on-time" style={{fontSize:14}}>🏆</span>}
                                {c.rate>=85&&<span title="Fellowship Excellence" style={{fontSize:14}}>⭐</span>}
                                {c.trend.startsWith('+')&&parseInt(c.trend)>=10&&<span title="Soul Winner" style={{fontSize:14}}>🌱</span>}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Top Fellowship Heads */}
              <div style={card()}>
                <div style={{fontSize:13,fontWeight:600,color:t.text,marginBottom:14}}>Fellowship Heads</div>
                <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:12}}>
                  {[
                    {name:'Youth Fellowship',score:88,attendance:82,growth:'+12%',sla:'A',tier:'Faithful Steward',tierBg:'#E1F5EE',tierC:'#085041'},
                    {name:'Women Fellowship',score:79,attendance:76,growth:'+7%',sla:'A+',tier:'Faithful Steward',tierBg:'#E1F5EE',tierC:'#085041'},
                    {name:'Men Fellowship',score:71,attendance:74,growth:'+5%',sla:'B',tier:'Consistent Servant',tierBg:'#F3F4F6',tierC:'#374151'},
                  ].map(f=>(
                    <div key={f.name} style={{background:t.cardInner,borderRadius:10,padding:'14px 16px',border:`0.5px solid ${t.border}`}}>
                      <div style={{fontSize:12,fontWeight:600,color:t.text,marginBottom:8}}>{f.name}</div>
                      <div style={{fontSize:26,fontWeight:700,color:f.score>=80?t.teal:t.amber,marginBottom:4}}>{f.score}%</div>
                      <div style={{display:'flex',justifyContent:'space-between',fontSize:11,marginBottom:8}}>
                        <span style={{color:t.muted}}>Attendance: {f.attendance}%</span>
                        <span style={{color:t.teal,fontWeight:500}}>{f.growth}</span>
                      </div>
                      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                        <span style={{fontSize:10,padding:'2px 8px',borderRadius:10,background:f.tierBg,color:f.tierC,fontWeight:500}}>{f.tier}</span>
                        <span style={{fontSize:12,fontWeight:700,color:f.score>=80?t.teal:t.amber}}>SLA: {f.sla}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Badge showcase */}
              <div style={card()}>
                <div style={{fontSize:13,fontWeight:600,color:t.text,marginBottom:14}}>Badge System</div>
                <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:10}}>
                  {[
                    {icon:'⏰',name:'On Time',desc:'4 consecutive on-time submissions',cat:'Promptness'},
                    {icon:'🕐',name:'Clockwork',desc:'8 consecutive on-time submissions',cat:'Promptness'},
                    {icon:'⚡',name:'Unbroken',desc:'12 consecutive on-time — full quarter',cat:'Promptness'},
                    {icon:'🏆',name:'Legendary',desc:'52 consecutive on-time — full year',cat:'Promptness'},
                    {icon:'👁',name:'Sharp Eye',desc:'Zero disputed submissions in a month',cat:'Accuracy'},
                    {icon:'💎',name:'Crystal Clear',desc:'Zero disputes for a full quarter',cat:'Accuracy'},
                    {icon:'🛡',name:'Ironclad',desc:'Zero disputes pilot to year end',cat:'Accuracy'},
                    {icon:'🌱',name:'First Harvest',desc:'First new convert in your cell',cat:'Growth'},
                    {icon:'⭐',name:'Soul Winner',desc:'5 new converts retained',cat:'Growth'},
                    {icon:'🚀',name:'Multiplier',desc:'Cell membership doubled',cat:'Growth'},
                    {icon:'❤',name:'Restorer',desc:'5 members restored after absence',cat:'Care'},
                    {icon:'👑',name:'Crown Carrier',desc:'Crown of Excellence for full quarter',cat:'Leadership'},
                  ].map(b=>(
                    <div key={b.name} style={{background:t.cardInner,borderRadius:8,padding:'10px 12px',border:`0.5px solid ${t.border}`}}>
                      <div style={{fontSize:22,marginBottom:6}}>{b.icon}</div>
                      <div style={{fontSize:11,fontWeight:600,color:t.text,marginBottom:2}}>{b.name}</div>
                      <div style={{fontSize:10,color:t.muted,lineHeight:1.4,marginBottom:4}}>{b.desc}</div>
                      <div style={{fontSize:9,color:t.purple,fontWeight:500,textTransform:'uppercase',letterSpacing:'0.4px'}}>{b.cat}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {page==='commendation'&&(
            <div style={{display:'flex',flexDirection:'column',gap:14}}>
              <div>
                <div style={{fontSize:15,fontWeight:700,color:t.text}}>Commend a Leader</div>
                <div style={{fontSize:12,color:t.muted,marginTop:2}}>Send a personalised notification to any leader. Delivered instantly to their portal.</div>
              </div>

              <div style={card()}>
                <div style={{fontSize:13,fontWeight:600,color:t.text,marginBottom:14}}>Select message type</div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:16}}>
                  {[
                    {type:'commendation',icon:'⭐',title:'Pastor Commends You',desc:'Celebrate a leader for outstanding performance'},
                    {type:'meeting',icon:'📅',title:'Meeting Request',desc:'Request a one-on-one meeting with a leader'},
                    {type:'encouragement',icon:'💛',title:'Pastoral Encouragement',desc:'Send a warm message to a leader who needs support'},
                    {type:'announcement',icon:'📣',title:'Announcement',desc:'Broadcast to all leaders of a fellowship or department'},
                  ].map(m=>(
                    <div key={m.type} style={{background:t.cardInner,borderRadius:10,padding:'14px',border:`0.5px solid ${t.border}`,cursor:'pointer'}}
                      onMouseEnter={e=>e.currentTarget.style.border=`0.5px solid #534AB7`}
                      onMouseLeave={e=>e.currentTarget.style.border=`0.5px solid ${t.border}`}>
                      <div style={{fontSize:22,marginBottom:8}}>{m.icon}</div>
                      <div style={{fontSize:12,fontWeight:600,color:t.text,marginBottom:4}}>{m.title}</div>
                      <div style={{fontSize:11,color:t.muted,lineHeight:1.4}}>{m.desc}</div>
                    </div>
                  ))}
                </div>

                <div style={{display:'flex',flexDirection:'column',gap:10}}>
                  <div>
                    <div style={{fontSize:10,color:t.muted,textTransform:'uppercase',letterSpacing:'0.5px',marginBottom:6}}>Send to</div>
                    <select style={{width:'100%',border:`0.5px solid ${t.border}`,borderRadius:8,padding:'9px 11px',fontSize:12,background:t.input,color:t.text,outline:'none'}}>
                      <option value="">Select a leader...</option>
                      {CELLS_DATA.slice(0,10).map(c=>(
                        <option key={c.cell} value={c.leader}>{c.leader} — {c.cell}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <div style={{fontSize:10,color:t.muted,textTransform:'uppercase',letterSpacing:'0.5px',marginBottom:6}}>Message</div>
                    <textarea rows={4} placeholder="Write your message here... The leader will receive this as an in-app notification."
                      style={{width:'100%',border:`0.5px solid ${t.border}`,borderRadius:8,padding:'9px 11px',fontSize:12,background:t.input,color:t.text,outline:'none',resize:'none',fontFamily:'inherit'}}/>
                  </div>
                  <button style={{background:'#534AB7',color:'#fff',border:'none',borderRadius:10,padding:'12px',fontSize:13,fontWeight:600,cursor:'pointer'}}>
                    Send notification
                  </button>
                </div>
              </div>

              {/* Recent commendations */}
              <div style={card()}>
                <div style={{fontSize:13,fontWeight:600,color:t.text,marginBottom:12}}>Recent messages sent</div>
                {[
                  {to:'Bro. Emeka Okafor',type:'commendation',msg:'Excellent submission consistency this month. Keep it up!',time:'2 days ago'},
                  {to:'Sis. Chioma Uzoma',type:'encouragement',msg:'We see your commitment. The church appreciates your dedication.',time:'5 days ago'},
                  {to:'All Youth Leaders',type:'announcement',msg:'Reminder: Leadership review meeting this Friday at 4pm.',time:'1 week ago'},
                ].map((r,i)=>(
                  <div key={i} style={{display:'flex',gap:10,padding:'10px 0',borderBottom:i<2?`0.5px solid ${t.border}`:'none'}}>
                    <div style={{width:32,height:32,borderRadius:8,background:'#EEEDFE',display:'flex',alignItems:'center',justifyContent:'center',fontSize:14,flexShrink:0}}>
                      {r.type==='commendation'?'⭐':r.type==='encouragement'?'💛':'📣'}
                    </div>
                    <div style={{flex:1}}>
                      <div style={{fontSize:12,fontWeight:500,color:t.text}}>{r.to}</div>
                      <div style={{fontSize:11,color:t.sub,marginTop:2,lineHeight:1.4}}>{r.msg}</div>
                      <div style={{fontSize:10,color:t.muted,marginTop:3}}>{r.time}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {page==='requisitions'&&(
            <PastorRequisitions t={t} dark={dark} />
          )}
          {page==='validation'&&(
            <FellowshipValidation t={t} dark={dark} />
          )}
          {page==='settings'&&(
            <ChurchSettingsPanel t={t} dark={dark} />
          )}
          {page==='admin'&&(
            <AdminRedirect />
          )}
          {page==='subscription'&&(
            <SubscriptionPanel t={t} dark={dark} />
          )}
          {page==='prayer'&&(
            <div style={{display:'flex',flexDirection:'column',gap:14}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                <div>
                  <div style={{fontSize:15,fontWeight:700,color:t.text}}>Prayer Requests</div>
                  <div style={{fontSize:12,color:t.muted,marginTop:2}}>All prayer requests submitted by cell leaders, fellowship heads, and the care team.</div>
                </div>
                <div style={{display:'flex',gap:8}}>
                  <span style={{fontSize:11,padding:'4px 12px',borderRadius:20,background:t.tealBg,color:t.teal,fontWeight:500,cursor:'pointer'}}>Open</span>
                  <span style={{fontSize:11,padding:'4px 12px',borderRadius:20,background:t.purpleBg,color:t.purple,fontWeight:500,cursor:'pointer'}}>All</span>
                </div>
              </div>
              <PrayerRequestDashboard t={t} dark={dark} />
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
