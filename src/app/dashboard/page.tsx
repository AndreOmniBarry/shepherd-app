'use client';
import { useScreenSize } from '@/hooks/useScreenSize';
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
type NavPage = 'dashboard'|'attendance'|'giving'|'members'|'cells'|'departments'|'reports'|'recognition'|'commendation'|'prayer'|'requisitions'|'validation'|'settings'|'admin'|'subscription'|'service_planner'|'events'|'workforce';
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
  const router = React.useRef<ReturnType<typeof import('next/navigation').useRouter> | null>(null);
  React.useEffect(() => {
    // Use window.location for reliability in static builds
    if (typeof window !== 'undefined') {
      window.location.href = '/admin';
    }
  }, []);
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
  const [activeTab, setActiveTab] = React.useState<'profile'|'structure'|'services'|'team'>('profile');

  const [churchName, setChurchName] = React.useState('');
  const [country, setCountry] = React.useState('Nigeria');
  const [currency, setCurrency] = React.useState('NGN');
  const [denomination, setDenomination] = React.useState('');
  const [foundedYear, setFoundedYear] = React.useState('');
  const [contactEmail, setContactEmail] = React.useState('');
  const [contactPhone, setContactPhone] = React.useState('');
  const [address, setAddress] = React.useState('');
  const [website, setWebsite] = React.useState('');
  const [logoUrl, setLogoUrl] = React.useState('');
  const [structureType, setStructureType] = React.useState('cell_church');
  const [tier1Label, setTier1Label] = React.useState('Fellowship');
  const [tier2Label, setTier2Label] = React.useState('Cell');
  const [tier1HeadLabel, setTier1HeadLabel] = React.useState('Fellowship Head');
  const [tier2HeadLabel, setTier2HeadLabel] = React.useState('Cell Leader');
  const [serviceDays, setServiceDays] = React.useState<string[]>(['Sunday']);
  const [users, setUsers] = React.useState<{id:string;full_name:string;email:string;role:string}[]>([]);

  React.useEffect(() => {
    fetch('/api/settings/church-config', { credentials: 'include' })
      .then(r => r.json())
      .then(({ data }) => {
        if (data?.config) {
          const c = data.config;
          setConfig(c);
          setChurchName(c.church_name || '');
          setCountry(c.country || 'Nigeria');
          setCurrency(c.currency || 'NGN');
          setStructureType(c.structure_type || 'cell_church');
          setTier1Label(c.tier1_label || 'Fellowship');
          setTier2Label(c.tier2_label || 'Cell');
          setTier1HeadLabel(c.tier1_head_label || 'Fellowship Head');
          setTier2HeadLabel(c.tier2_head_label || 'Cell Leader');
          setServiceDays(c.service_days || ['Sunday']);
          setLogoUrl(c.logo_url || '');
          if (c.church_profile) {
            const p = typeof c.church_profile === 'string' ? JSON.parse(c.church_profile) : c.church_profile;
            setDenomination(p.denomination || '');
            setFoundedYear(p.founded_year || '');
            setContactEmail(p.contact_email || '');
            setContactPhone(p.contact_phone || '');
            setAddress(p.address || '');
            setWebsite(p.website || '');
          }
        }
      }).catch(() => {});

    fetch('/api/auth/me', { credentials: 'include' })
      .then(r => r.json())
      .then(({ data }) => {
        if (data?.role === 'overseer' || data?.role === 'lead_tech' || data?.role === 'pa') {
          fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/users?select=id,full_name,email,role&order=role.asc`, {
            headers: { 'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '', 'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''}` }
          }).then(r => r.json()).then(d => { if (Array.isArray(d)) setUsers(d); }).catch(() => {});
        }
      }).catch(() => {});
  }, []);

  async function save() {
    setSaving(true);
    try {
      const currentProfile = typeof config.church_profile === 'string'
        ? JSON.parse(config.church_profile as string)
        : (config.church_profile || {});
      await fetch('/api/settings/church-config', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({
          church_name: churchName, country, currency,
          structure_type: structureType,
          tier1_label: tier1Label || null, tier2_label: tier2Label || null,
          tier1_head_label: tier1HeadLabel, tier2_head_label: tier2HeadLabel,
          service_days: serviceDays, logo_url: logoUrl || null,
          church_profile: JSON.stringify({ ...currentProfile, denomination, founded_year: foundedYear, contact_email: contactEmail, contact_phone: contactPhone, address, website }),
        }),
      });
      setSaved(true); setTimeout(() => setSaved(false), 3000);
    } catch {} setSaving(false);
  }

  const STRUCTURES = [
    { value: 'cell_church', label: 'Cell Church', sub: 'Fellowship → Cell → Member' },
    { value: 'zonal', label: 'Zonal Church', sub: 'Zone → District → Cell → Member' },
    { value: 'campus', label: 'Multi-Campus', sub: 'Campus → Fellowship → Cell → Member' },
    { value: 'department', label: 'Department Church', sub: 'Department → Unit → Member' },
    { value: 'house_network', label: 'House Church Network', sub: 'Network → Home Group → Member' },
    { value: 'single', label: 'Single Congregation', sub: 'Pastor → Member' },
  ];
  const DAYS = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const CURRENCIES = [{code:'NGN',label:'₦ Nigerian Naira'},{code:'GHS',label:'GH₵ Ghanaian Cedi'},{code:'KES',label:'KSh Kenyan Shilling'},{code:'ZAR',label:'R South African Rand'},{code:'USD',label:'$ US Dollar'},{code:'GBP',label:'£ British Pound'}];
  const ROLE_LABELS: Record<string,string> = { overseer:'Overseer / Lead Pastor', pa:'PA', lead_tech:'Lead Tech', fellowship_head:'Fellowship Head', cell_leader:'Cell Leader', department_head:'Department Head', care_team:'Care Team', accounts:'Accounts', partnership:'Partnership' };

  const cardS = (e?: React.CSSProperties): React.CSSProperties => ({ background: t.card, border: `0.5px solid ${t.border}`, borderRadius: 12, padding: '18px 20px', ...e });
  const inputS: React.CSSProperties = { width: '100%', border: `0.5px solid ${t.border}`, borderRadius: 8, padding: '9px 12px', fontSize: 13, background: t.input, color: t.text, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' as const };
  const labelS: React.CSSProperties = { fontSize: 10, color: t.muted, textTransform: 'uppercase' as const, letterSpacing: '0.4px', marginBottom: 5, display: 'block' };
  const gridS: React.CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 };

  return (
    <div style={{display:'flex',flexDirection:'column',gap:16,maxWidth:800}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
        <div>
          <div style={{fontSize:19,fontWeight:700,color:t.text,letterSpacing:'-0.3px'}}>Church Settings</div>
          <div style={{fontSize:12,color:t.muted,marginTop:2}}>Manage your church profile, structure, service days and team</div>
        </div>
        <button onClick={save} disabled={saving}
          style={{background:saved?t.teal:t.purple,color:'#fff',border:'none',borderRadius:9,padding:'10px 22px',fontSize:13,fontWeight:600,cursor:'pointer',transition:'background 0.2s'}}>
          {saving?'Saving…':saved?'✓ Saved':'Save changes'}
        </button>
      </div>

      <div style={{display:'flex',gap:0,borderBottom:`0.5px solid ${t.border}`}}>
        {(['profile','structure','services','team'] as const).map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            style={{padding:'9px 18px',border:'none',borderBottom:`2px solid ${activeTab===tab?t.purple:'transparent'}`,background:activeTab===tab?t.purpleBg:'transparent',fontSize:12,fontWeight:activeTab===tab?600:400,color:activeTab===tab?t.purple:t.muted,cursor:'pointer',textTransform:'capitalize' as const}}>
            {tab === 'profile' ? 'Church Profile' : tab.charAt(0).toUpperCase()+tab.slice(1)}
          </button>
        ))}
      </div>

      {activeTab === 'profile' && (
        <div style={{display:'flex',flexDirection:'column',gap:14}}>
          <div style={cardS()}>
            <div style={{fontSize:13,fontWeight:600,color:t.text,marginBottom:14}}>Identity</div>
            <div style={{display:'flex',flexDirection:'column',gap:12}}>
              <div><label style={labelS}>Church name *</label><input value={churchName} onChange={e=>setChurchName(e.target.value)} placeholder="e.g. The Comforters House Global" style={inputS}/></div>
              <div style={gridS}>
                <div><label style={labelS}>Denomination</label>
                  <select value={denomination} onChange={e=>setDenomination(e.target.value)} style={inputS}>
                    <option value="">Select…</option>
                    {['Pentecostal / Charismatic','Evangelical / Baptist','Methodist / Anglican','Catholic','Apostolic / Prophetic','Seventh-day Adventist','Interdenominational','Other'].map(d=><option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
                <div><label style={labelS}>Year founded</label><input value={foundedYear} onChange={e=>setFoundedYear(e.target.value)} type="number" placeholder="e.g. 1998" style={inputS}/></div>
              </div>
              <div style={gridS}>
                <div><label style={labelS}>Country</label>
                  <select value={country} onChange={e=>setCountry(e.target.value)} style={inputS}>
                    {['Nigeria','Ghana','Kenya','South Africa','Uganda','Tanzania','United Kingdom','United States','Other'].map(c=><option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div><label style={labelS}>Currency</label>
                  <select value={currency} onChange={e=>setCurrency(e.target.value)} style={inputS}>
                    {CURRENCIES.map(c=><option key={c.code} value={c.code}>{c.label}</option>)}
                  </select>
                </div>
              </div>
            </div>
          </div>
          <div style={cardS()}>
            <div style={{fontSize:13,fontWeight:600,color:t.text,marginBottom:14}}>Contact & Location</div>
            <div style={{display:'flex',flexDirection:'column',gap:12}}>
              <div style={gridS}>
                <div><label style={labelS}>Contact email</label><input value={contactEmail} onChange={e=>setContactEmail(e.target.value)} placeholder="church@example.com" type="email" style={inputS}/></div>
                <div><label style={labelS}>Contact phone</label><input value={contactPhone} onChange={e=>setContactPhone(e.target.value)} placeholder="+234 XXX XXX XXXX" style={inputS}/></div>
              </div>
              <div><label style={labelS}>Physical address</label><input value={address} onChange={e=>setAddress(e.target.value)} placeholder="12 Church Street, Lagos" style={inputS}/></div>
              <div style={gridS}>
                <div><label style={labelS}>Website</label><input value={website} onChange={e=>setWebsite(e.target.value)} placeholder="https://yourchurch.org" style={inputS}/></div>
                <div><label style={labelS}>Logo URL</label><input value={logoUrl} onChange={e=>setLogoUrl(e.target.value)} placeholder="https://…/logo.png" style={inputS}/></div>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'structure' && (
        <div style={{display:'flex',flexDirection:'column',gap:14}}>
          <div style={cardS()}>
            <div style={{fontSize:13,fontWeight:600,color:t.text,marginBottom:14}}>Structure model</div>
            <div style={{display:'flex',flexDirection:'column',gap:8}}>
              {STRUCTURES.map(s=>(
                <button key={s.value} onClick={()=>setStructureType(s.value)}
                  style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'11px 14px',borderRadius:9,border:`0.5px solid ${structureType===s.value?t.purple:t.border}`,background:structureType===s.value?t.purpleBg:t.input,cursor:'pointer',textAlign:'left' as const}}>
                  <div><div style={{fontSize:13,fontWeight:500,color:t.text}}>{s.label}</div><div style={{fontSize:11,color:t.muted,marginTop:2}}>{s.sub}</div></div>
                  {structureType===s.value&&<span style={{width:8,height:8,borderRadius:'50%',background:t.purple,flexShrink:0}}/>}
                </button>
              ))}
            </div>
          </div>
          {structureType !== 'single' && (
            <div style={cardS()}>
              <div style={{fontSize:13,fontWeight:600,color:t.text,marginBottom:14}}>Label customisation</div>
              <div style={{display:'flex',flexDirection:'column',gap:12}}>
                <div style={gridS}>
                  <div><label style={labelS}>Tier 1 name</label><input value={tier1Label} onChange={e=>setTier1Label(e.target.value)} placeholder="e.g. Fellowship" style={inputS}/></div>
                  <div><label style={labelS}>Tier 1 leader title</label><input value={tier1HeadLabel} onChange={e=>setTier1HeadLabel(e.target.value)} placeholder="e.g. Fellowship Head" style={inputS}/></div>
                </div>
                <div style={gridS}>
                  <div><label style={labelS}>Tier 2 name</label><input value={tier2Label} onChange={e=>setTier2Label(e.target.value)} placeholder="e.g. Cell" style={inputS}/></div>
                  <div><label style={labelS}>Tier 2 leader title</label><input value={tier2HeadLabel} onChange={e=>setTier2HeadLabel(e.target.value)} placeholder="e.g. Cell Leader" style={inputS}/></div>
                </div>
                <div style={{background:t.purpleBg,borderRadius:8,padding:'10px 14px',fontSize:12,color:t.purple}}>
                  Preview: {[tier1Label,tier2Label].filter(Boolean).join(' → ')} → Member
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'services' && (
        <div style={cardS()}>
          <div style={{fontSize:13,fontWeight:600,color:t.text,marginBottom:6}}>Service days</div>
          <div style={{fontSize:12,color:t.muted,marginBottom:14}}>Days your church holds regular services. Sets attendance windows and absence alerts.</div>
          <div style={{display:'flex',gap:8,flexWrap:'wrap' as const,marginBottom:16}}>
            {DAYS.map(day=>(
              <button key={day} onClick={()=>setServiceDays(prev=>prev.includes(day)?prev.filter(d=>d!==day):[...prev,day])}
                style={{padding:'8px 16px',borderRadius:20,border:`0.5px solid ${serviceDays.includes(day)?t.purple:t.border}`,background:serviceDays.includes(day)?t.purple:t.input,color:serviceDays.includes(day)?'#fff':t.sub,fontSize:12,fontWeight:serviceDays.includes(day)?600:400,cursor:'pointer'}}>
                {day}
              </button>
            ))}
          </div>
          <div style={{background:t.purpleBg,borderRadius:8,padding:'10px 14px',fontSize:12,color:t.purple}}>
            Active: {serviceDays.join(', ') || 'None selected'}
          </div>
        </div>
      )}

      {activeTab === 'team' && (
        <div style={{display:'flex',flexDirection:'column',gap:14}}>
          <div style={{...cardS({padding:0,overflow:'hidden'})}}>
            <div style={{padding:'14px 18px',borderBottom:`0.5px solid ${t.border}`,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <div style={{fontSize:13,fontWeight:600,color:t.text}}>Team members ({users.length})</div>
            </div>
            {users.length === 0 ? (
              <div style={{padding:32,textAlign:'center' as const,color:t.muted,fontSize:13}}>No team members found.</div>
            ) : users.map((u,i)=>(
              <div key={u.id} style={{padding:'12px 18px',borderBottom:i<users.length-1?`0.5px solid ${t.border}`:'none',display:'flex',alignItems:'center',gap:12}}>
                <div style={{width:34,height:34,borderRadius:'50%',background:t.purpleBg,display:'flex',alignItems:'center',justifyContent:'center',fontSize:12,fontWeight:600,color:t.purple,flexShrink:0}}>
                  {u.full_name?.slice(0,2).toUpperCase()||'??'}
                </div>
                <div style={{flex:1}}>
                  <div style={{fontSize:13,fontWeight:500,color:t.text}}>{u.full_name||'Unknown'}</div>
                  <div style={{fontSize:11,color:t.muted}}>{u.email}</div>
                </div>
                <span style={{fontSize:10,padding:'2px 9px',borderRadius:10,fontWeight:600,background:t.purpleBg,color:t.purple}}>
                  {ROLE_LABELS[u.role]||u.role}
                </span>
              </div>
            ))}
          </div>
          <div style={{...cardS({padding:'14px 18px'}),background:t.purpleBg,border:`0.5px solid rgba(83,74,183,0.15)`}}>
            <div style={{fontSize:12,fontWeight:600,color:t.purple,marginBottom:4}}>Registration link</div>
            <div style={{fontSize:11,color:t.sub,marginBottom:10}}>Share this with staff. They register and are assigned their role.</div>
            <div style={{display:'flex',gap:8,alignItems:'center'}}>
              <div style={{flex:1,background:t.white,border:`0.5px solid ${t.border}`,borderRadius:7,padding:'8px 12px',fontSize:11,color:t.sub,fontFamily:'monospace',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' as const}}>
                {typeof window !== 'undefined' ? window.location.origin : 'https://shepherd-app-beta.vercel.app'}/register
              </div>
              <button onClick={()=>{navigator.clipboard.writeText((typeof window!=='undefined'?window.location.origin:'')+'/register');}}
                style={{background:t.purple,color:'#fff',border:'none',borderRadius:7,padding:'8px 14px',fontSize:11,fontWeight:600,cursor:'pointer',whiteSpace:'nowrap' as const}}>
                Copy link
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


const ITEM_TYPES = [
  { value:'prayer', label:'Opening Prayer', icon:'🙏', color:'#534AB7' },
  { value:'song', label:'Praise & Worship', icon:'🎵', color:'#1D9E75' },
  { value:'announcement', label:'Announcements', icon:'📢', color:'#BA7517' },
  { value:'offering', label:'Tithes & Offering', icon:'💰', color:'#D85A30' },
  { value:'sermon', label:'Sermon / Message', icon:'📖', color:'#534AB7' },
  { value:'item', label:'General Item', icon:'📋', color:'#9890C4' },
  { value:'benediction', label:'Benediction', icon:'✝', color:'#534AB7' },
  { value:'break', label:'Break / Interval', icon:'⏸', color:'#9890C4' },
];

function ServicePlannerPage({ t, dark, screenWidth }: { t: Record<string,string>; dark: boolean; screenWidth: number }) {
  const [plans, setPlans] = React.useState<Record<string,unknown>[]>([]);
  const [selected, setSelected] = React.useState<Record<string,unknown>|null>(null);
  const [items, setItems] = React.useState<Record<string,unknown>[]>([]);
  const [users, setUsers] = React.useState<{id:string;full_name:string;role:string}[]>([]);
  const [creating, setCreating] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [publishing, setPublishing] = React.useState(false);
  const [toast, setToast] = React.useState('');
  const [newPlan, setNewPlan] = React.useState({ service_date: '', service_type: 'sunday', title: 'Sunday Service', theme: '' });

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3500); };

  React.useEffect(() => {
    fetch('/api/service-planner', { credentials: 'include' })
      .then(r => r.json()).then(({ data }) => { if (data?.plans) setPlans(data.plans); }).catch(() => {});
    fetch('/api/auth/me', { credentials: 'include' })
      .then(r => r.json()).then(({ data }) => {
        if (data?.id) {
          fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/users?select=id,full_name,role&order=full_name.asc`, {
            headers: { 'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '', 'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''}` }
          }).then(r => r.json()).then(d => { if (Array.isArray(d)) setUsers(d); }).catch(() => {});
        }
      }).catch(() => {});
  }, []);

  function loadItems(planId: string) {
    fetch(`/api/service-planner/items?plan_id=${planId}`, { credentials: 'include' })
      .then(r => r.json()).then(({ data }) => { if (data?.items) setItems(data.items); }).catch(() => {});
  }

  function selectPlan(plan: Record<string,unknown>) {
    setSelected(plan); loadItems(plan.id as string);
  }

  function addItem(type: string) {
    const def = ITEM_TYPES.find(t => t.value === type) || ITEM_TYPES[5];
    const newItem = { id: `new_${Date.now()}`, item_type: type, title: def.label, description: '', duration_minutes: 10, assigned_to: null, assigned_to_name: null, color: def.color, is_completed: false, position: items.length };
    setItems(prev => [...prev, newItem]);
  }

  function updateItem(id: string, field: string, value: unknown) {
    setItems(prev => prev.map(item => (item.id as string) === id ? { ...item, [field]: value } : item));
    if (field === 'assigned_to' && value) {
      const u = users.find(u => u.id === value);
      setItems(prev => prev.map(item => (item.id as string) === id ? { ...item, assigned_to_name: u?.full_name || null } : item));
    }
  }

  function removeItem(id: string) { setItems(prev => prev.filter(item => (item.id as string) !== id)); }

  function moveItem(id: string, dir: 1 | -1) {
    const idx = items.findIndex(item => (item.id as string) === id);
    if (idx + dir < 0 || idx + dir >= items.length) return;
    const newItems = [...items];
    [newItems[idx], newItems[idx + dir]] = [newItems[idx + dir], newItems[idx]];
    setItems(newItems);
  }

  async function createPlan() {
    if (!newPlan.service_date || !newPlan.title) return;
    setSaving(true);
    try {
      const res = await fetch('/api/service-planner', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ ...newPlan, items: [] }),
      });
      const d = await res.json();
      if (res.ok) {
        setPlans(prev => [d.data.plan, ...prev]);
        selectPlan(d.data.plan);
        setCreating(false);
        showToast('Service plan created');
      }
    } catch {} setSaving(false);
  }

  async function savePlan() {
    if (!selected) return;
    setSaving(true);
    try {
      await fetch('/api/service-planner', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ id: selected.id, items: items.map((item, i) => ({ ...item, position: i, id: String(item.id).startsWith('new_') ? undefined : item.id })) }),
      });
      showToast('Plan saved');
    } catch {} setSaving(false);
  }

  async function publishPlan() {
    if (!selected) return;
    setPublishing(true);
    try {
      await fetch('/api/service-planner', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ id: selected.id, status: 'published', items: items.map((item, i) => ({ ...item, position: i, id: String(item.id).startsWith('new_') ? undefined : item.id })) }),
      });
      setSelected(prev => prev ? { ...prev, status: 'published' } : prev);
      setPlans(prev => prev.map(p => (p.id as string) === (selected.id as string) ? { ...p, status: 'published' } : p));
      showToast('Plan published — all assigned leaders notified');
    } catch {} setPublishing(false);
  }

  const cardS = (e?: React.CSSProperties): React.CSSProperties => ({ background: t.card, border: `0.5px solid ${t.border}`, borderRadius: 12, ...e });
  const inputS: React.CSSProperties = { border: `0.5px solid ${t.border}`, borderRadius: 8, padding: '8px 11px', fontSize: 13, background: t.input, color: t.text, outline: 'none', fontFamily: 'inherit' };
  const isWide = screenWidth >= 1024;
  const totalDuration = items.reduce((a, item) => a + ((item.duration_minutes as number) || 0), 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {toast && <div style={{ background: t.teal, color: '#fff', borderRadius: 9, padding: '10px 16px', fontSize: 13, fontWeight: 500 }}>✓ {toast}</div>}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: 19, fontWeight: 700, color: t.text, letterSpacing: '-0.3px' }}>Service Planner</div>
          <div style={{ fontSize: 12, color: t.muted, marginTop: 2 }}>Build Sunday programmes, assign roles, publish to all leaders</div>
        </div>
        <button onClick={() => setCreating(true)} style={{ background: t.purple, color: '#fff', border: 'none', borderRadius: 9, padding: '10px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>+ New plan</button>
      </div>

      {creating && (
        <div style={cardS({ padding: '20px' })}>
          <div style={{ fontSize: 14, fontWeight: 600, color: t.text, marginBottom: 14 }}>New service plan</div>
          <div style={{ display: 'grid', gridTemplateColumns: isWide ? '1fr 1fr 1fr 1fr' : '1fr 1fr', gap: 12 }}>
            <div style={{ gridColumn: isWide ? '1 / 3' : '1 / -1' }}>
              <div style={{ fontSize: 10, color: t.muted, textTransform: 'uppercase' as const, letterSpacing: '0.4px', marginBottom: 5 }}>Service title</div>
              <input value={newPlan.title} onChange={e => setNewPlan(p => ({ ...p, title: e.target.value }))} style={{ ...inputS, width: '100%', boxSizing: 'border-box' as const }} />
            </div>
            <div>
              <div style={{ fontSize: 10, color: t.muted, textTransform: 'uppercase' as const, letterSpacing: '0.4px', marginBottom: 5 }}>Date *</div>
              <input type="date" value={newPlan.service_date} onChange={e => setNewPlan(p => ({ ...p, service_date: e.target.value }))} style={{ ...inputS, width: '100%', boxSizing: 'border-box' as const }} />
            </div>
            <div>
              <div style={{ fontSize: 10, color: t.muted, textTransform: 'uppercase' as const, letterSpacing: '0.4px', marginBottom: 5 }}>Type</div>
              <select value={newPlan.service_type} onChange={e => setNewPlan(p => ({ ...p, service_type: e.target.value }))} style={{ ...inputS, width: '100%' }}>
                {['sunday','wednesday','friday','special'].map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase()+s.slice(1)} Service</option>)}
              </select>
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <div style={{ fontSize: 10, color: t.muted, textTransform: 'uppercase' as const, letterSpacing: '0.4px', marginBottom: 5 }}>Theme / Series (optional)</div>
              <input value={newPlan.theme} onChange={e => setNewPlan(p => ({ ...p, theme: e.target.value }))} placeholder="e.g. The Power of Prayer" style={{ ...inputS, width: '100%', boxSizing: 'border-box' as const }} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
            <button onClick={createPlan} disabled={saving || !newPlan.service_date}
              style={{ background: t.purple, color: '#fff', border: 'none', borderRadius: 8, padding: '10px 20px', fontSize: 13, fontWeight: 600, cursor: 'pointer', opacity: saving || !newPlan.service_date ? 0.7 : 1 }}>
              {saving ? 'Creating…' : 'Create plan'}
            </button>
            <button onClick={() => setCreating(false)} style={{ background: t.input, color: t.sub, border: `0.5px solid ${t.border}`, borderRadius: 8, padding: '10px 16px', fontSize: 13, cursor: 'pointer' }}>Cancel</button>
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: isWide ? '280px 1fr' : '1fr', gap: 16 }}>
        {/* Plans list */}
        <div style={cardS({ padding: 0, overflow: 'hidden' })}>
          <div style={{ padding: '12px 16px', borderBottom: `0.5px solid ${t.border}`, fontSize: 12, fontWeight: 600, color: t.text }}>Plans ({plans.length})</div>
          {plans.length === 0 ? (
            <div style={{ padding: 24, textAlign: 'center' as const, color: t.muted, fontSize: 13 }}>No plans yet. Create your first service plan.</div>
          ) : plans.map((plan, i) => (
            <div key={plan.id as string} onClick={() => selectPlan(plan)}
              style={{ padding: '12px 16px', borderBottom: i < plans.length - 1 ? `0.5px solid ${t.border}` : 'none', cursor: 'pointer', background: (selected?.id as string) === (plan.id as string) ? t.purpleBg : 'transparent', transition: 'background 0.12s' }}>
              <div style={{ fontSize: 13, fontWeight: 500, color: t.text }}>{plan.title as string}</div>
              <div style={{ fontSize: 11, color: t.muted, marginTop: 2 }}>
                {plan.service_date ? new Date((plan.service_date as string) + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
              </div>
              <span style={{ fontSize: 10, fontWeight: 600, padding: '1px 7px', borderRadius: 8, marginTop: 4, display: 'inline-block', background: plan.status === 'published' ? t.tealBg : plan.status === 'live' ? '#FAEEDA' : t.purpleBg, color: plan.status === 'published' ? t.teal : plan.status === 'live' ? t.amber : t.purple }}>
                {(plan.status as string).toUpperCase()}
              </span>
            </div>
          ))}
        </div>

        {/* Plan editor */}
        {selected ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={cardS({ padding: '16px 18px' })}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap' as const, gap: 10 }}>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: t.text }}>{selected.title as string}</div>
                  <div style={{ fontSize: 12, color: t.muted }}>
                    {selected.service_date ? new Date((selected.service_date as string) + 'T12:00:00').toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : ''} · {items.length} items · {totalDuration} min total
                  </div>
                  {selected.theme && <div style={{ fontSize: 12, color: t.purple, marginTop: 3 }}>Theme: {selected.theme as string}</div>}
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={savePlan} disabled={saving} style={{ background: t.purpleBg, color: t.purple, border: 'none', borderRadius: 8, padding: '8px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                    {saving ? 'Saving…' : 'Save'}
                  </button>
                  {selected.status !== 'published' && (
                    <button onClick={publishPlan} disabled={publishing} style={{ background: t.teal, color: '#fff', border: 'none', borderRadius: 8, padding: '8px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer', opacity: publishing ? 0.7 : 1 }}>
                      {publishing ? 'Publishing…' : '📢 Publish & notify'}
                    </button>
                  )}
                  {selected.status === 'published' && (
                    <span style={{ fontSize: 12, fontWeight: 600, color: t.teal, padding: '8px 14px', background: t.tealBg, borderRadius: 8 }}>✓ Published</span>
                  )}
                </div>
              </div>
            </div>

            {/* Item type adder */}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' as const }}>
              {ITEM_TYPES.map(type => (
                <button key={type.value} onClick={() => addItem(type.value)}
                  style={{ padding: '6px 12px', borderRadius: 8, border: `0.5px solid ${t.border}`, background: t.card, fontSize: 12, cursor: 'pointer', color: t.sub, display: 'flex', alignItems: 'center', gap: 5 }}>
                  <span>{type.icon}</span> {type.label}
                </button>
              ))}
            </div>

            {/* Order of service items */}
            {items.length === 0 ? (
              <div style={cardS({ padding: 32, textAlign: 'center' as const })}>
                <div style={{ fontSize: 13, color: t.muted }}>Add items above to build the order of service.</div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {items.map((item, idx) => {
                  const def = ITEM_TYPES.find(t => t.value === item.item_type) || ITEM_TYPES[5];
                  return (
                    <div key={item.id as string} style={cardS({ padding: '14px 16px', borderLeft: `3px solid ${item.color as string || def.color}` })}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flexShrink: 0 }}>
                          <button onClick={() => moveItem(item.id as string, -1)} disabled={idx === 0} style={{ background: 'none', border: 'none', cursor: idx === 0 ? 'default' : 'pointer', color: t.muted, fontSize: 12, padding: '2px' }}>↑</button>
                          <span style={{ fontSize: 11, color: t.muted, textAlign: 'center' as const }}>{idx + 1}</span>
                          <button onClick={() => moveItem(item.id as string, 1)} disabled={idx === items.length - 1} style={{ background: 'none', border: 'none', cursor: idx === items.length - 1 ? 'default' : 'pointer', color: t.muted, fontSize: 12, padding: '2px' }}>↓</button>
                        </div>
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px 1fr', gap: 8 }}>
                            <input value={item.title as string} onChange={e => updateItem(item.id as string, 'title', e.target.value)}
                              style={{ ...inputS, fontWeight: 600 }} placeholder="Item title" />
                            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                              <input type="number" value={item.duration_minutes as number} onChange={e => updateItem(item.id as string, 'duration_minutes', parseInt(e.target.value) || 0)}
                                style={{ ...inputS, width: '60px' }} min={1} />
                              <span style={{ fontSize: 11, color: t.muted }}>min</span>
                            </div>
                            <select value={(item.assigned_to as string) || ''} onChange={e => updateItem(item.id as string, 'assigned_to', e.target.value || null)}
                              style={{ ...inputS }}>
                              <option value="">Assign to…</option>
                              {users.map(u => <option key={u.id} value={u.id}>{u.full_name} ({u.role.replace('_',' ')})</option>)}
                            </select>
                          </div>
                          <input value={(item.description as string) || ''} onChange={e => updateItem(item.id as string, 'description', e.target.value)}
                            style={{ ...inputS, fontSize: 12, color: t.sub }} placeholder="Notes or instructions (optional)" />
                        </div>
                        <button onClick={() => removeItem(item.id as string)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: t.muted, fontSize: 16, padding: '4px', flexShrink: 0 }}>×</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          <div style={cardS({ padding: 40, textAlign: 'center' as const })}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>📋</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: t.text, marginBottom: 6 }}>Select a plan to edit</div>
            <div style={{ fontSize: 12, color: t.muted }}>Choose a plan from the list or create a new one.</div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// EVENTS PAGE
// ─────────────────────────────────────────────────────────────
const EVENT_TYPES = ['programme','conference','vigil','concert','outreach','training','thanksgiving','dedication','other'];
const EVENT_ICONS: Record<string,string> = { programme:'📋', conference:'🎤', vigil:'🕯', concert:'🎶', outreach:'🌍', training:'📚', thanksgiving:'🙏', dedication:'👶', other:'⭐' };

function EventsPage({ t, dark, screenWidth }: { t: Record<string,string>; dark: boolean; screenWidth: number }) {
  const [events, setEvents] = React.useState<Record<string,unknown>[]>([]);
  const [selected, setSelected] = React.useState<Record<string,unknown>|null>(null);
  const [registrations, setRegistrations] = React.useState<Record<string,unknown>[]>([]);
  const [creating, setCreating] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [toast, setToast] = React.useState('');
  const [regTab, setRegTab] = React.useState<'list'|'attendance'>('list');
  const [form, setForm] = React.useState({ title: '', event_date: '', event_type: 'programme', start_time: '', end_time: '', location: '', description: '', is_free: true, price: '', capacity: '', banner_url: '', whatsapp_confirmation: true, sms_confirmation: true });

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3500); };

  React.useEffect(() => {
    fetch('/api/events', { credentials: 'include' })
      .then(r => r.json()).then(({ data }) => { if (data?.events) setEvents(data.events); }).catch(() => {});
  }, []);

  function loadRegistrations(eventId: string) {
    fetch(`/api/events/register?event_id=${eventId}`, { credentials: 'include' })
      .then(r => r.json()).then(({ data }) => { if (data?.registrations) setRegistrations(data.registrations); }).catch(() => {});
  }

  function selectEvent(ev: Record<string,unknown>) {
    setSelected(ev); loadRegistrations(ev.id as string); setRegTab('list');
  }

  async function createEvent() {
    if (!form.title || !form.event_date) return;
    setSaving(true);
    try {
      const res = await fetch('/api/events', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ ...form, is_free: form.is_free, price: form.is_free ? 0 : parseFloat(form.price) || 0, capacity: form.capacity ? parseInt(form.capacity) : null }),
      });
      const d = await res.json();
      if (res.ok) {
        setEvents(prev => [d.data, ...prev]);
        setCreating(false);
        setForm({ title: '', event_date: '', event_type: 'programme', start_time: '', end_time: '', location: '', description: '', is_free: true, price: '', capacity: '', banner_url: '', whatsapp_confirmation: true, sms_confirmation: true });
        showToast('Event created');
      }
    } catch {} setSaving(false);
  }

  async function toggleAttendance(regId: string, attended: boolean) {
    await fetch('/api/events/register', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
      body: JSON.stringify({ id: regId, attended: !attended }),
    });
    setRegistrations(prev => prev.map(r => (r.id as string) === regId ? { ...r, attended: !attended } : r));
  }

  async function closeEvent(id: string) {
    await fetch('/api/events', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
      body: JSON.stringify({ id, registration_open: false }),
    });
    setEvents(prev => prev.map(e => (e.id as string) === id ? { ...e, registration_open: false } : e));
    if (selected?.id === id) setSelected(prev => prev ? { ...prev, registration_open: false } : prev);
    showToast('Registration closed');
  }

  const cardS = (e?: React.CSSProperties): React.CSSProperties => ({ background: t.card, border: `0.5px solid ${t.border}`, borderRadius: 12, ...e });
  const inputS: React.CSSProperties = { border: `0.5px solid ${t.border}`, borderRadius: 8, padding: '8px 11px', fontSize: 13, background: t.input, color: t.text, outline: 'none', fontFamily: 'inherit', width: '100%', boxSizing: 'border-box' as const };
  const isWide = screenWidth >= 1024;
  const attended = registrations.filter(r => r.attended).length;
  const conversionRate = registrations.length > 0 ? Math.round((attended / registrations.length) * 100) : 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {toast && <div style={{ background: t.teal, color: '#fff', borderRadius: 9, padding: '10px 16px', fontSize: 13, fontWeight: 500 }}>✓ {toast}</div>}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: 19, fontWeight: 700, color: t.text, letterSpacing: '-0.3px' }}>Events & Programmes</div>
          <div style={{ fontSize: 12, color: t.muted, marginTop: 2 }}>Create events, manage registration, track attendance and conversion</div>
        </div>
        <button onClick={() => setCreating(true)} style={{ background: t.purple, color: '#fff', border: 'none', borderRadius: 9, padding: '10px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>+ New event</button>
      </div>

      {creating && (
        <div style={cardS({ padding: '20px' })}>
          <div style={{ fontSize: 14, fontWeight: 600, color: t.text, marginBottom: 14 }}>New event</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'grid', gridTemplateColumns: isWide ? '1fr 1fr 1fr' : '1fr 1fr', gap: 12 }}>
              <div style={{ gridColumn: '1 / -1' }}>
                <div style={{ fontSize: 10, color: t.muted, textTransform: 'uppercase' as const, letterSpacing: '0.4px', marginBottom: 5 }}>Event title *</div>
                <input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} placeholder="e.g. December Praise Night" style={inputS} />
              </div>
              <div>
                <div style={{ fontSize: 10, color: t.muted, textTransform: 'uppercase' as const, letterSpacing: '0.4px', marginBottom: 5 }}>Date *</div>
                <input type="date" value={form.event_date} onChange={e => setForm(p => ({ ...p, event_date: e.target.value }))} style={inputS} />
              </div>
              <div>
                <div style={{ fontSize: 10, color: t.muted, textTransform: 'uppercase' as const, letterSpacing: '0.4px', marginBottom: 5 }}>Type</div>
                <select value={form.event_type} onChange={e => setForm(p => ({ ...p, event_type: e.target.value }))} style={inputS}>
                  {EVENT_TYPES.map(et => <option key={et} value={et}>{et.charAt(0).toUpperCase()+et.slice(1)}</option>)}
                </select>
              </div>
              <div>
                <div style={{ fontSize: 10, color: t.muted, textTransform: 'uppercase' as const, letterSpacing: '0.4px', marginBottom: 5 }}>Capacity (optional)</div>
                <input type="number" value={form.capacity} onChange={e => setForm(p => ({ ...p, capacity: e.target.value }))} placeholder="Leave blank for unlimited" style={inputS} />
              </div>
              <div>
                <div style={{ fontSize: 10, color: t.muted, textTransform: 'uppercase' as const, letterSpacing: '0.4px', marginBottom: 5 }}>Start time</div>
                <input type="time" value={form.start_time} onChange={e => setForm(p => ({ ...p, start_time: e.target.value }))} style={inputS} />
              </div>
              <div>
                <div style={{ fontSize: 10, color: t.muted, textTransform: 'uppercase' as const, letterSpacing: '0.4px', marginBottom: 5 }}>End time</div>
                <input type="time" value={form.end_time} onChange={e => setForm(p => ({ ...p, end_time: e.target.value }))} style={inputS} />
              </div>
              <div style={{ gridColumn: isWide ? '1 / 3' : '1 / -1' }}>
                <div style={{ fontSize: 10, color: t.muted, textTransform: 'uppercase' as const, letterSpacing: '0.4px', marginBottom: 5 }}>Location</div>
                <input value={form.location} onChange={e => setForm(p => ({ ...p, location: e.target.value }))} placeholder="Church auditorium, online, etc." style={inputS} />
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <div style={{ fontSize: 10, color: t.muted, textTransform: 'uppercase' as const, letterSpacing: '0.4px', marginBottom: 5 }}>Description</div>
                <textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} rows={3}
                  style={{ ...inputS, resize: 'vertical' as const }} placeholder="Tell people what to expect…" />
              </div>
            </div>

            <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' as const }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: t.text }}>
                <input type="checkbox" checked={form.is_free} onChange={e => setForm(p => ({ ...p, is_free: e.target.checked }))} />
                Free entry
              </label>
              {!form.is_free && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 13, color: t.muted }}>₦</span>
                  <input type="number" value={form.price} onChange={e => setForm(p => ({ ...p, price: e.target.value }))} placeholder="Ticket price" style={{ ...inputS, width: 140 }} />
                </div>
              )}
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: t.text }}>
                <input type="checkbox" checked={form.whatsapp_confirmation} onChange={e => setForm(p => ({ ...p, whatsapp_confirmation: e.target.checked }))} />
                WhatsApp confirmation
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: t.text }}>
                <input type="checkbox" checked={form.sms_confirmation} onChange={e => setForm(p => ({ ...p, sms_confirmation: e.target.checked }))} />
                SMS confirmation
              </label>
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={createEvent} disabled={saving || !form.title || !form.event_date}
                style={{ background: t.purple, color: '#fff', border: 'none', borderRadius: 8, padding: '10px 20px', fontSize: 13, fontWeight: 600, cursor: 'pointer', opacity: saving || !form.title || !form.event_date ? 0.7 : 1 }}>
                {saving ? 'Creating…' : 'Create event'}
              </button>
              <button onClick={() => setCreating(false)} style={{ background: t.input, color: t.sub, border: `0.5px solid ${t.border}`, borderRadius: 8, padding: '10px 16px', fontSize: 13, cursor: 'pointer' }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: isWide ? '300px 1fr' : '1fr', gap: 16 }}>
        {/* Events list */}
        <div style={cardS({ padding: 0, overflow: 'hidden' })}>
          <div style={{ padding: '12px 16px', borderBottom: `0.5px solid ${t.border}`, fontSize: 12, fontWeight: 600, color: t.text }}>All events ({events.length})</div>
          {events.length === 0 ? (
            <div style={{ padding: 32, textAlign: 'center' as const, color: t.muted, fontSize: 13 }}>No events yet.</div>
          ) : events.map((ev, i) => (
            <div key={ev.id as string} onClick={() => selectEvent(ev)}
              style={{ padding: '12px 16px', borderBottom: i < events.length - 1 ? `0.5px solid ${t.border}` : 'none', cursor: 'pointer', background: (selected?.id as string) === (ev.id as string) ? t.purpleBg : 'transparent', transition: 'background 0.12s' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                <span style={{ fontSize: 16 }}>{EVENT_ICONS[ev.event_type as string] || '⭐'}</span>
                <div style={{ fontSize: 13, fontWeight: 500, color: t.text }}>{ev.title as string}</div>
              </div>
              <div style={{ fontSize: 11, color: t.muted }}>
                {ev.event_date ? new Date((ev.event_date as string) + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'} · {(ev.registration_count as number) || 0} registered
              </div>
              <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                <span style={{ fontSize: 10, fontWeight: 600, padding: '1px 7px', borderRadius: 8, background: ev.status === 'upcoming' ? t.tealBg : ev.status === 'cancelled' ? t.coralBg : t.amberBg, color: ev.status === 'upcoming' ? t.teal : ev.status === 'cancelled' ? t.coral : t.amber }}>
                  {(ev.status as string).toUpperCase()}
                </span>
                {ev.is_free ? <span style={{ fontSize: 10, color: t.muted }}>Free</span> : <span style={{ fontSize: 10, color: t.amber, fontWeight: 600 }}>₦{Number(ev.price).toLocaleString()}</span>}
              </div>
            </div>
          ))}
        </div>

        {/* Event detail */}
        {selected ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {/* Event header */}
            <div style={cardS({ padding: '18px' })}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' as const }}>
                <div>
                  <div style={{ fontSize: 17, fontWeight: 700, color: t.text, marginBottom: 4 }}>{selected.title as string}</div>
                  <div style={{ fontSize: 12, color: t.muted }}>
                    {selected.event_date ? new Date((selected.event_date as string) + 'T12:00:00').toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : '—'}
                    {selected.start_time && ` · ${selected.start_time}`}
                    {selected.location && ` · ${selected.location}`}
                  </div>
                  {selected.description && <div style={{ fontSize: 12, color: t.sub, marginTop: 6, lineHeight: 1.5 }}>{selected.description as string}</div>}
                </div>
                <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                  <button onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/events/${selected.public_slug}`); showToast('Registration link copied!'); }}
                    style={{ background: t.purpleBg, color: t.purple, border: 'none', borderRadius: 8, padding: '8px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                    📋 Copy link
                  </button>
                  {selected.registration_open && (
                    <button onClick={() => closeEvent(selected.id as string)}
                      style={{ background: t.coralBg, color: t.coral, border: 'none', borderRadius: 8, padding: '8px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                      Close registration
                    </button>
                  )}
                </div>
              </div>

              {/* KPIs */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginTop: 14 }}>
                {[
                  { label: 'Registered', value: registrations.length, color: t.purple, bg: t.purpleBg },
                  { label: 'Attended', value: attended, color: t.teal, bg: t.tealBg },
                  { label: 'Conversion', value: `${conversionRate}%`, color: t.amber, bg: t.amberBg },
                  { label: 'Capacity', value: selected.capacity ? `${registrations.length}/${selected.capacity}` : '∞', color: t.sub, bg: t.input },
                ].map((kpi, i) => (
                  <div key={i} style={{ background: kpi.bg, borderRadius: 9, padding: '10px 12px', textAlign: 'center' as const }}>
                    <div style={{ fontSize: 20, fontWeight: 700, color: kpi.color }}>{kpi.value}</div>
                    <div style={{ fontSize: 11, color: kpi.color, opacity: 0.8 }}>{kpi.label}</div>
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', gap: 8, marginTop: 14, fontSize: 12, color: t.muted }}>
                <span>WhatsApp confirmation: <strong style={{ color: selected.whatsapp_confirmation ? t.teal : t.coral }}>{selected.whatsapp_confirmation ? 'On' : 'Off'}</strong></span>
                <span>·</span>
                <span>SMS: <strong style={{ color: selected.sms_confirmation ? t.teal : t.coral }}>{selected.sms_confirmation ? 'On' : 'Off'}</strong></span>
                <span>·</span>
                <span style={{ color: t.muted, fontSize: 11 }}>Confirmations queued — will send when provider is configured</span>
              </div>
            </div>

            {/* Registrations */}
            <div style={cardS({ padding: 0, overflow: 'hidden' })}>
              <div style={{ display: 'flex', borderBottom: `0.5px solid ${t.border}` }}>
                {(['list','attendance'] as const).map(tab => (
                  <button key={tab} onClick={() => setRegTab(tab)}
                    style={{ flex: 1, padding: '11px', border: 'none', borderBottom: `2px solid ${regTab === tab ? t.purple : 'transparent'}`, background: regTab === tab ? t.purpleBg : 'transparent', fontSize: 12, fontWeight: regTab === tab ? 600 : 400, color: regTab === tab ? t.purple : t.muted, cursor: 'pointer', textTransform: 'capitalize' as const }}>
                    {tab === 'list' ? `Registrations (${registrations.length})` : 'Mark Attendance'}
                  </button>
                ))}
              </div>
              {registrations.length === 0 ? (
                <div style={{ padding: 32, textAlign: 'center' as const, color: t.muted, fontSize: 13 }}>No registrations yet. Share the registration link.</div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                      <tr style={{ borderBottom: `0.5px solid ${t.border}` }}>
                        {['Name', 'Phone', 'Type', 'Channel', ...(regTab === 'attendance' ? ['Attended'] : [])].map(h => (
                          <th key={h} style={{ padding: '10px 14px', textAlign: 'left' as const, fontSize: 10, color: t.muted, fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: '0.4px', whiteSpace: 'nowrap' as const }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {registrations.map((reg, i) => (
                        <tr key={reg.id as string} style={{ borderBottom: i < registrations.length - 1 ? `0.5px solid ${t.border}` : 'none' }}>
                          <td style={{ padding: '10px 14px', color: t.text, fontWeight: 500 }}>{reg.full_name as string}</td>
                          <td style={{ padding: '10px 14px', color: t.muted }}>{reg.phone as string}</td>
                          <td style={{ padding: '10px 14px' }}>
                            <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 8, background: reg.is_member ? t.purpleBg : t.input, color: reg.is_member ? t.purple : t.muted, fontWeight: 600 }}>
                              {reg.is_member ? 'Member' : 'Walk-in'}
                            </span>
                          </td>
                          <td style={{ padding: '10px 14px' }}>
                            <span style={{ fontSize: 11, color: t.muted }}>{(reg.preferred_comms as string) || '—'}</span>
                          </td>
                          {regTab === 'attendance' && (
                            <td style={{ padding: '10px 14px' }}>
                              <button onClick={() => toggleAttendance(reg.id as string, reg.attended as boolean)}
                                style={{ padding: '5px 12px', borderRadius: 7, border: 'none', fontSize: 11, fontWeight: 600, cursor: 'pointer', background: reg.attended ? t.tealBg : t.input, color: reg.attended ? t.teal : t.muted }}>
                                {reg.attended ? '✓ Present' : 'Absent'}
                              </button>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div style={cardS({ padding: 40, textAlign: 'center' as const })}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>🗓</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: t.text, marginBottom: 6 }}>Select an event</div>
            <div style={{ fontSize: 12, color: t.muted }}>Choose an event to see registrations and mark attendance.</div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// WORKFORCE INTELLIGENCE PAGE
// ─────────────────────────────────────────────────────────────
function WorkforceIntelligencePage({ t, dark, screenWidth }: { t: Record<string,string>; dark: boolean; screenWidth: number }) {
  const [data, setData] = React.useState<Record<string,unknown>|null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    fetch('/api/workforce/intelligence', { credentials: 'include' })
      .then(r => r.json()).then(({ data: d }) => { if (d) setData(d); })
      .catch(() => {}).finally(() => setLoading(false));
  }, []);

  const cardS = (e?: React.CSSProperties): React.CSSProperties => ({ background: t.card, border: `0.5px solid ${t.border}`, borderRadius: 12, ...e });
  const isWide = screenWidth >= 1024;

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 60, flexDirection: 'column', gap: 12 }}>
      <div style={{ width: 28, height: 28, border: `3px solid ${t.border}`, borderTopColor: t.purple, borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
      <div style={{ fontSize: 13, color: t.muted }}>Loading workforce intelligence…</div>
    </div>
  );

  const summary = data?.summary as Record<string,number> || {};
  const deptStats = (data?.department_stats as Record<string,unknown>[]) || [];
  const overcommitted = (data?.overcommitted as Record<string,unknown>[]) || [];
  const rankings = (data?.reliability_rankings as Record<string,unknown>[]) || [];
  const nextSunday = data?.next_sunday as string;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <div style={{ fontSize: 19, fontWeight: 700, color: t.text, letterSpacing: '-0.3px' }}>Workforce Intelligence</div>
        <div style={{ fontSize: 12, color: t.muted, marginTop: 2 }}>
          Department coverage, volunteer reliability, and staffing gaps for {nextSunday ? new Date(nextSunday + 'T12:00:00').toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' }) : 'upcoming Sunday'}
        </div>
      </div>

      {/* Summary KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: isWide ? 'repeat(5,1fr)' : 'repeat(2,1fr)', gap: 12 }}>
        {[
          { label: 'Total workforce', value: summary.total_workforce || 0, color: t.purple, bg: t.purpleBg, icon: '👥' },
          { label: 'Departments', value: summary.total_departments || 0, color: t.sub, bg: t.input, icon: '🏢' },
          { label: 'Scheduled', value: summary.departments_scheduled_next_sunday || 0, color: t.teal, bg: t.tealBg, icon: '✅' },
          { label: 'With gaps', value: summary.departments_with_gaps || 0, color: summary.departments_with_gaps > 0 ? t.coral : t.teal, bg: summary.departments_with_gaps > 0 ? t.coralBg : t.tealBg, icon: '⚠' },
          { label: 'Overcommitted', value: summary.overcommitted_members || 0, color: summary.overcommitted_members > 0 ? t.amber : t.teal, bg: summary.overcommitted_members > 0 ? t.amberBg : t.tealBg, icon: '🔥' },
        ].map((kpi, i) => (
          <div key={i} style={{ ...cardS({ padding: '16px' }), background: kpi.bg }}>
            <div style={{ fontSize: 22, marginBottom: 6 }}>{kpi.icon}</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: kpi.color }}>{kpi.value}</div>
            <div style={{ fontSize: 11, color: kpi.color, opacity: 0.8 }}>{kpi.label}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: isWide ? '1fr 1fr' : '1fr', gap: 16 }}>
        {/* Department coverage */}
        <div style={cardS({ padding: 0, overflow: 'hidden' })}>
          <div style={{ padding: '14px 18px', borderBottom: `0.5px solid ${t.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: t.text }}>Department coverage — next Sunday</div>
          </div>
          {deptStats.length === 0 ? (
            <div style={{ padding: 32, textAlign: 'center' as const, color: t.muted, fontSize: 13 }}>No departments found. Add departments first.</div>
          ) : deptStats.map((dept, i) => {
            const hasRoster = dept.next_roster_coverage === 'scheduled';
            return (
              <div key={dept.id as string} style={{ padding: '12px 18px', borderBottom: i < deptStats.length - 1 ? `0.5px solid ${t.border}` : 'none', display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: hasRoster ? t.teal : t.coral, flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: t.text }}>{dept.name as string}</div>
                  <div style={{ fontSize: 11, color: t.muted }}>
                    {dept.member_count as number} members · {dept.roster_count as number} rosters built
                    {hasRoster && ` · ${dept.assigned_next} assigned next Sunday`}
                  </div>
                </div>
                <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 9px', borderRadius: 8, background: hasRoster ? t.tealBg : t.coralBg, color: hasRoster ? t.teal : t.coral, whiteSpace: 'nowrap' as const }}>
                  {hasRoster ? '✓ Scheduled' : '⚠ No roster'}
                </span>
              </div>
            );
          })}
        </div>

        {/* Reliability rankings */}
        <div style={cardS({ padding: 0, overflow: 'hidden' })}>
          <div style={{ padding: '14px 18px', borderBottom: `0.5px solid ${t.border}` }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: t.text }}>Volunteer reliability rankings</div>
            <div style={{ fontSize: 11, color: t.muted, marginTop: 2 }}>Based on assignments vs attendance across all Sundays</div>
          </div>
          {rankings.length === 0 ? (
            <div style={{ padding: 32, textAlign: 'center' as const, color: t.muted, fontSize: 13 }}>No workforce profiles yet. Profiles are built automatically as rosters are published.</div>
          ) : rankings.map((r, i) => {
            const score = r.reliability_score as number || 0;
            const scoreColor = score >= 4 ? t.teal : score >= 2.5 ? t.amber : t.coral;
            return (
              <div key={r.member_id as string} style={{ padding: '11px 18px', borderBottom: i < rankings.length - 1 ? `0.5px solid ${t.border}` : 'none', display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 28, height: 28, borderRadius: '50%', background: t.purpleBg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: t.purple, flexShrink: 0 }}>
                  {i + 1}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: t.text }}>{r.full_name as string}</div>
                  <div style={{ fontSize: 11, color: t.muted }}>
                    {r.total_attended as number}/{r.total_assigned as number} services attended
                    {r.last_served && ` · Last served ${new Date((r.last_served as string) + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`}
                  </div>
                </div>
                <div style={{ textAlign: 'right' as const }}>
                  <div style={{ fontSize: 16, fontWeight: 700, color: scoreColor }}>{score.toFixed(1)}</div>
                  <div style={{ fontSize: 10, color: scoreColor }}>{score >= 4 ? 'Excellent' : score >= 2.5 ? 'Good' : 'Low'}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Overcommitted members alert */}
      {overcommitted.length > 0 && (
        <div style={cardS({ padding: '16px 18px', background: t.amberBg, border: `0.5px solid rgba(186,117,23,0.2)` })}>
          <div style={{ fontSize: 13, fontWeight: 600, color: t.amber, marginBottom: 8 }}>⚠ {overcommitted.length} overcommitted volunteer{overcommitted.length !== 1 ? 's' : ''}</div>
          <div style={{ fontSize: 12, color: t.sub, marginBottom: 12 }}>These members are assigned to 3 or more departments. Consider redistributing their load to prevent burnout.</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' as const }}>
            {overcommitted.map(m => (
              <span key={m.member_id as string} style={{ fontSize: 11, padding: '3px 10px', borderRadius: 8, background: 'rgba(186,117,23,0.15)', color: t.amber, fontWeight: 500 }}>
                {m.department_count} departments
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Gap alert */}
      {(summary.departments_with_gaps || 0) > 0 && (
        <div style={cardS({ padding: '16px 18px', background: t.coralBg, border: `0.5px solid rgba(216,90,48,0.2)` })}>
          <div style={{ fontSize: 13, fontWeight: 600, color: t.coral, marginBottom: 4 }}>
            🚨 {summary.departments_with_gaps} department{summary.departments_with_gaps !== 1 ? 's' : ''} with no roster for next Sunday
          </div>
          <div style={{ fontSize: 12, color: t.sub }}>Department heads have been notified. Ask them to build and publish their rosters before Saturday 6pm.</div>
        </div>
      )}
    </div>
  );
}
