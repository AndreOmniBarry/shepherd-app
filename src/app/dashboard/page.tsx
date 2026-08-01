'use client';
import { useTheme } from '@/hooks/useTheme';
import React from 'react';
import NotificationBell from "@/components/NotificationBell";
import MyAccountButton from "@/components/MyAccountButton";
import Icon from "@/components/Icon";
import PastorAttendance from '@/components/PastorAttendance';
import AttendanceHistoryPanel from '@/components/AttendanceHistoryPanel';
import TotalHistoryPanel from '@/components/TotalHistoryPanel';
import PastorGiving from '@/components/PastorGiving';
import PastorRequisitions from '@/components/PastorRequisitions';
import FellowshipValidation from '@/components/FellowshipValidation';
import PrayerRequestPanel from '@/components/PrayerRequestPanel';
import ServicePlannerPanel from '@/components/ServicePlannerPanel';
import EventsPanel from '@/components/EventsPanel';
import CareFollowupPanel from '@/components/CareFollowupPanel';
import ChatNavButton from '@/components/ChatNavButton';
import { SkeletonCard, SkeletonRow } from '@/components/Skeleton';
import LoadingScreen from '@/components/LoadingScreen';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  LineChart, Line, BarChart, Bar, AreaChart, Area, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell
} from 'recharts';

type KPI = { total_members:number; active_members:number; today_present:number; today_cells_reported:number; today_cells_total:number; ytd_giving_ngn:number; active_cells:number; new_members_month:number; giving_breakdown?:{name:string;amount:number;pct:number}[]; growth_trend?:{month:string;count:number}[]; gender_distribution?:{name:string;count:number;pct:number}[]; gender_known?:number; age_bands?:{band:string;n:number;p:number}[]; age_known?:number; };
type ChatMessage = { role:'user'|'agent'; text:string; agent?:string; loading?:boolean; };
type AgentName = 'ktava'|'arkwind'|'moshe'|'numbers';
type NavPage = 'dashboard'|'attendance'|'giving'|'members'|'cells'|'departments'|'reports'|'recognition'|'commendation'|'prayer'|'care_followup'|'requisitions'|'validation'|'settings'|'admin'|'workforce'|'events'|'action_board';
type CellRow = { id:string; cell:string; fel:string; leader:string; members:number; avg:number; rate:number; trend:string; status:string };


// ── Helpers ────────────────────────────────────────────────────
function fmt(n:number|undefined|null){return n!=null?n.toLocaleString():'—';}
function fmtNGN(n:number){if(n>=1_000_000)return`₦${(n/1_000_000).toFixed(1)}M`;if(n>=1_000)return`₦${(n/1_000).toFixed(0)}k`;return`₦${n}`;}
function greeting(){const h=new Date().getHours();return h<12?'Good morning':h<17?'Good afternoon':'Good evening';}
const PASTOR_TIER_ROLES=['overseer','general_overseer','branch_pastor'];
function greetingName(userName:string,userRole:string){const first=userName.split(' ')[0];return PASTOR_TIER_ROLES.includes(userRole)?`Pastor ${first}`:first;}


// Export helpers
function exportCSV(data:Record<string,unknown>[], filename:string){
  if(!data.length)return;
  const keys=Object.keys(data[0]);
  const rows=[keys.join(','),...data.map(r=>keys.map(k=>JSON.stringify(r[k]??'')).join(','))];
  const blob=new Blob([rows.join('\n')],{type:'text/csv'});
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=filename+'.csv';a.click();
}

const PRAYER_FILTER_LABEL:{[k:string]:string}={open:'New request',prayed:'Prayed',all:'All'};

function PrayerRequestDashboard({t,dark}:{t:Record<string,string>;dark:boolean}){
  const [requests,setRequests]=React.useState<{id:string;request:string;requester_name:string;category:string;status:string;submitted_by_role:string;created_at:string}[]>([]);
  const [filter,setFilter]=React.useState('open');
  const [deleteTarget,setDeleteTarget]=React.useState<string|null>(null);
  const [deleting,setDeleting]=React.useState(false);
  React.useEffect(()=>{
    fetch(`/api/prayer-requests?status=${filter}`,{credentials:'include'})
      .then(r=>r.json()).then(({data})=>{if(data?.requests)setRequests(data.requests);}).catch(()=>{});
  },[filter]);
  async function markPrayed(id:string){
    await fetch('/api/prayer-requests',{method:'PATCH',headers:{'Content-Type':'application/json'},credentials:'include',body:JSON.stringify({id,status:'prayed'})});
    setRequests(prev=>prev.map(r=>r.id===id?{...r,status:'prayed'}:r));
  }
  async function confirmDeletePrayed(){
    if(!deleteTarget)return;
    setDeleting(true);
    try{
      const res=await fetch(`/api/prayer-requests?id=${deleteTarget}`,{method:'DELETE',credentials:'include'});
      if(res.ok)setRequests(prev=>prev.filter(r=>r.id!==deleteTarget));
    }finally{setDeleting(false);setDeleteTarget(null);}
  }
  const STATUS_CFG:{[k:string]:{bg:string;text:string;label:string}}={
    open:{bg:'#EEEDFE',text:'#3C3489',label:'New request'},
    prayed:{bg:'#E1F5EE',text:'#085041',label:'Prayed'},
    closed:{bg:'#F3F4F6',text:'#6B7280',label:'Closed'},
  };
  const CATS:{[k:string]:string}={general:'General',healing:'Healing',family:'Family',finance:'Finance',guidance:'Guidance',thanksgiving:'Thanksgiving',other:'Other'};
  return(
    <div style={{display:'flex',flexDirection:'column',gap:10}}>
      {deleteTarget&&(
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.4)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:200}} onClick={()=>!deleting&&setDeleteTarget(null)}>
          <div onClick={e=>e.stopPropagation()} style={{background:t.card,borderRadius:14,border:`0.5px solid ${t.border}`,padding:22,maxWidth:360,width:'90%'}}>
            <div style={{fontSize:15,fontWeight:700,color:t.text,marginBottom:8}}>Delete this prayer request?</div>
            <div style={{fontSize:12,color:t.sub,lineHeight:1.5,marginBottom:18}}>This cannot be undone.</div>
            <div style={{display:'flex',gap:8,justifyContent:'flex-end'}}>
              <button onClick={()=>setDeleteTarget(null)} disabled={deleting}
                style={{background:t.input,color:t.text,border:'none',borderRadius:8,padding:'8px 16px',fontSize:12,fontWeight:500,cursor:'pointer',fontFamily:'inherit'}}>
                Cancel
              </button>
              <button onClick={confirmDeletePrayed} disabled={deleting}
                style={{background:t.coral,color:'#fff',border:'none',borderRadius:8,padding:'8px 16px',fontSize:12,fontWeight:600,cursor:deleting?'wait':'pointer',fontFamily:'inherit'}}>
                {deleting?'Deleting…':'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
      <div style={{display:'flex',gap:8,marginBottom:4}}>
        {['open','prayed','all'].map(f=>(
          <button key={f} onClick={()=>setFilter(f)}
            style={{padding:'5px 14px',borderRadius:20,border:'none',background:filter===f?'#534AB7':t.input,color:filter===f?'#fff':t.sub,fontSize:11,cursor:'pointer',fontWeight:filter===f?600:400,fontFamily:'inherit'}}>
            {PRAYER_FILTER_LABEL[f]||f}
          </button>
        ))}
        <span style={{marginLeft:'auto',fontSize:11,color:t.muted,alignSelf:'center'}}>{requests.length} request{requests.length!==1?'s':''}</span>
      </div>
      {requests.length===0?(
        <div style={{background:t.card,borderRadius:12,border:`0.5px solid ${t.border}`,padding:40,textAlign:'center'}}>
          <div style={{marginBottom:8,color:t.muted,display:'flex',justifyContent:'center'}}><Icon name="ti-heart" size={26}/></div>
          <div style={{fontSize:13,color:t.sub}}>No {filter==='all'?'':(PRAYER_FILTER_LABEL[filter]||filter).toLowerCase()+' '}prayer requests</div>
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
                    {r.status==='prayed'&&(
                      <button onClick={()=>setDeleteTarget(r.id)} title="Delete this prayer request"
                        style={{fontSize:10,padding:'3px 9px',borderRadius:8,background:t.coralBg,color:t.coral,border:'none',cursor:'pointer',fontWeight:500,fontFamily:'inherit'}}>
                        Delete
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

type WorkforceDeptMember = {member_id:string;full_name:string;membership_status:string|null;reliability_score:number|null;total_assigned:number|null;total_attended:number|null;last_served:string|null};
type WorkforceDeptRoster = {id:string;service_date:string;published:boolean;entries_count:number};
type WorkforceMemberDept = {department_id:string;department_name:string};
type WorkforceData = {
  summary: {total_workforce:number;total_departments:number;departments_scheduled_next_sunday:number;departments_with_gaps:number;overcommitted_members:number};
  department_stats: {id:string;name:string;member_count:number;next_roster_date:string|null;next_roster_coverage:string;roster_count:number;last_roster_date:string|null;assigned_next:number;members:WorkforceDeptMember[];recent_rosters:WorkforceDeptRoster[]}[];
  overcommitted: {member_id:string;full_name:string;department_count:number;departments:WorkforceMemberDept[]}[];
  reliability_rankings: {member_id:string;full_name:string;reliability_score:number;total_assigned:number;total_attended:number;last_served:string|null;departments:WorkforceMemberDept[]}[];
  next_sunday: string;
};

type ActionFlag = { severity: 'high' | 'medium'; category: string; entity: string; message: string; link: string };

const ACTION_CATEGORY_ICON: Record<string, string> = { attendance: 'ti-calendar-stats', care: 'ti-heart-handshake', workforce: 'ti-user-check', requisitions: 'ti-receipt' };

function ActionBoardPanel({t, branchId}: {t: Record<string,string>; branchId?: string}) {
  const [flags, setFlags] = React.useState<ActionFlag[]|null>(null);
  const [loading, setLoading] = React.useState(true);
  const [filter, setFilter] = React.useState<'all'|'high'|'medium'>('all');
  const router = useRouter();

  React.useEffect(() => {
    setLoading(true);
    const bq = branchId ? `?branch_id=${branchId}` : '';
    fetch(`/api/analytics/action-board${bq}`, { credentials: 'include' })
      .then(r => r.json()).then(({ data }) => setFlags(data?.flags || []))
      .finally(() => setLoading(false));
  }, [branchId]);

  if (loading) return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {[0, 1, 2, 3].map(i => <SkeletonCard key={i} lines={1} />)}
    </div>
  );
  if (!flags) return <div style={{fontSize:12,color:t.sub,padding:20}}>Could not load the action board.</div>;

  const shown = filter==='all' ? flags : flags.filter(f=>f.severity===filter);
  const highCount = flags.filter(f=>f.severity==='high').length;
  const medCount = flags.filter(f=>f.severity==='medium').length;

  return (
    <div style={{display:'flex',flexDirection:'column',gap:14}}>
      <div>
        <div style={{fontSize:15,fontWeight:700,color:t.text}}>Action Board</div>
        <div style={{fontSize:12,color:t.muted,marginTop:2}}>Every metric SHEP.HERD tracks, scanned against its own history — nothing here is hardcoded to a specific cell, department, or branch.</div>
      </div>

      <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:10}}>
        {[
          {label:'Needs immediate action',value:highCount,accent:'#D85A30',key:'high' as const},
          {label:'Worth a look',value:medCount,accent:'#BA7517',key:'medium' as const},
          {label:'All clear',value:flags.length===0?'✓':flags.length,accent:'#1D9E75',key:'all' as const},
        ].map(s=>(
          <div key={s.label} onClick={()=>setFilter(s.key)}
            style={{background:t.card,border:`0.5px solid ${filter===s.key?s.accent:t.border}`,borderRadius:12,padding:'14px 16px',cursor:'pointer',borderTop:`2.5px solid ${s.accent}`}}>
            <div style={{fontSize:22,fontWeight:700,color:t.text}}>{s.value}</div>
            <div style={{fontSize:11,color:t.muted,marginTop:2}}>{s.label}</div>
          </div>
        ))}
      </div>

      {shown.length === 0 ? (
        <div style={{background:t.card,border:`0.5px solid ${t.border}`,borderRadius:12,padding:40,textAlign:'center'}}>
          <div style={{fontSize:24,marginBottom:8}}>✓</div>
          <div style={{fontSize:13,color:t.sub}}>{filter==='all' ? 'Nothing needs attention right now.' : `Nothing in this category right now.`}</div>
        </div>
      ) : (
        <div style={{display:'flex',flexDirection:'column',gap:8}}>
          {shown.map((f,i)=>(
            <div key={i} onClick={()=>router.push(f.link)}
              style={{background:t.card,border:`0.5px solid ${t.border}`,borderLeft:`3px solid ${f.severity==='high'?'#D85A30':'#BA7517'}`,borderRadius:10,padding:'12px 16px',cursor:'pointer',display:'flex',gap:12,alignItems:'flex-start'}}>
              <div style={{color:f.severity==='high'?'#D85A30':'#BA7517',flexShrink:0,marginTop:1}}><Icon name={ACTION_CATEGORY_ICON[f.category]||'ti-alert-triangle'} size={16}/></div>
              <div style={{flex:1}}>
                <div style={{fontSize:13,color:t.text}}>{f.message}</div>
                <div style={{fontSize:10,color:t.muted,marginTop:3,textTransform:'uppercase',letterSpacing:'0.4px'}}>{f.category} · {f.entity}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function WorkforceIntelligencePanel({t, branchId, isMobile=false}: {t: Record<string,string>; branchId?: string; isMobile?: boolean}) {
  const [data, setData] = React.useState<WorkforceData|null>(null);
  const [loading, setLoading] = React.useState(true);
  const [expandedDept, setExpandedDept] = React.useState<string|null>(null);
  const [expandedMember, setExpandedMember] = React.useState<string|null>(null);

  React.useEffect(() => {
    setLoading(true);
    const bq = branchId ? `?branch_id=${branchId}` : '';
    fetch(`/api/workforce/intelligence${bq}`, { credentials: 'include' })
      .then(r => r.json())
      .then(({ data }) => setData(data))
      .finally(() => setLoading(false));
  }, [branchId]);

  if (loading) return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10 }}>
        {[0, 1, 2, 3].map(i => <SkeletonCard key={i} lines={1} />)}
      </div>
      <SkeletonCard>
        {Array.from({ length: 4 }, (_, i) => <SkeletonRow key={i} />)}
      </SkeletonCard>
    </div>
  );
  if (!data) return <div style={{fontSize:12,color:t.sub,padding:20}}>Could not load workforce data.</div>;

  const tiles = [
    {label:'Total Workforce',value:String(data.summary.total_workforce)},
    {label:'Departments',value:String(data.summary.total_departments)},
    {label:`Scheduled for ${new Date(data.next_sunday+'T00:00:00').toLocaleDateString('en-GB',{day:'numeric',month:'short'})}`,value:String(data.summary.departments_scheduled_next_sunday)},
    {label:'Departments With Gaps',value:String(data.summary.departments_with_gaps),alert:data.summary.departments_with_gaps>0},
    {label:'Overcommitted Members',value:String(data.summary.overcommitted_members),alert:data.summary.overcommitted_members>0},
  ];

  return (
    <div style={{display:'flex',flexDirection:'column',gap:14}}>
      <div>
        <div style={{fontSize:15,fontWeight:700,color:t.text}}>Workforce Intelligence</div>
        <div style={{fontSize:12,color:t.muted,marginTop:2}}>Cross-department serving coverage, gaps, and reliability — computed live from actual rosters, not estimates.</div>
      </div>

      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(140px,1fr))',gap:10}}>
        {tiles.map(s=>(
          <div key={s.label} style={{background:t.card,border:`0.5px solid ${s.alert?'rgba(216,90,48,0.3)':t.border}`,borderRadius:12,padding:'14px 16px'}}>
            <div style={{fontSize:20,fontWeight:700,color:s.alert?'#D85A30':t.text}}>{s.value}</div>
            <div style={{fontSize:11,color:t.muted,marginTop:2}}>{s.label}</div>
          </div>
        ))}
      </div>

      <div style={{background:t.card,border:`0.5px solid ${t.border}`,borderRadius:12,padding:'16px 18px'}}>
        <div style={{fontSize:13,fontWeight:600,color:t.text,marginBottom:2}}>Department Coverage</div>
        <div style={{fontSize:11,color:t.muted,marginBottom:10}}>Click a department to drill into its roster and every member serving there.</div>
        {isMobile ? (
          <div style={{display:'flex',flexDirection:'column',gap:8}}>
            {data.department_stats.map(d=>(
              <div key={d.id} style={{background:t.cardInner||t.purpleBg,borderRadius:10,border:`0.5px solid ${t.border}`,overflow:'hidden'}}>
                <div onClick={()=>setExpandedDept(v=>v===d.id?null:d.id)} style={{padding:'11px 13px',cursor:'pointer',background:expandedDept===d.id?t.purpleBg:'transparent'}}>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:8,marginBottom:6}}>
                    <div style={{fontWeight:expandedDept===d.id?600:500,fontSize:13,color:t.text}}>{expandedDept===d.id?'▾ ':'▸ '}{d.name}</div>
                    <span style={{fontSize:10,padding:'3px 9px',borderRadius:8,fontWeight:600,flexShrink:0,background:d.next_roster_coverage==='scheduled'?'#E1F5EE':'#FAECE7',color:d.next_roster_coverage==='scheduled'?'#085041':'#993C1D'}}>
                      {d.next_roster_coverage==='scheduled'?'Covered':'No roster yet'}
                    </span>
                  </div>
                  <div style={{fontSize:11,color:t.sub}}>{d.member_count} in workforce · {d.next_roster_date ? `${d.next_roster_date} · ${d.assigned_next} assigned` : 'No next-service date'}</div>
                </div>
                {expandedDept===d.id && (
                  <div style={{padding:'0 13px 14px',background:t.purpleBg}}>
                    <div style={{display:'flex',flexDirection:'column',gap:14,paddingTop:6}}>
                      <div>
                        <div style={{fontSize:10,color:t.muted,textTransform:'uppercase',letterSpacing:'0.4px',marginBottom:6}}>Members ({d.members.length})</div>
                        {d.members.length===0 ? <div style={{fontSize:12,color:t.muted}}>No members assigned yet.</div> : d.members.map(m=>(
                          <div key={m.member_id} style={{display:'flex',justifyContent:'space-between',fontSize:12,padding:'4px 0'}}>
                            <span style={{color:t.text}}>{m.full_name}</span>
                            <span style={{color:t.sub}}>{m.reliability_score!=null?`${m.reliability_score.toFixed(1)} · ${m.total_attended}/${m.total_assigned}`:'No history'}</span>
                          </div>
                        ))}
                      </div>
                      <div>
                        <div style={{fontSize:10,color:t.muted,textTransform:'uppercase',letterSpacing:'0.4px',marginBottom:6}}>Recent rosters</div>
                        {d.recent_rosters.length===0 ? <div style={{fontSize:12,color:t.muted}}>No rosters yet.</div> : d.recent_rosters.map(r=>(
                          <div key={r.id} style={{display:'flex',justifyContent:'space-between',fontSize:12,padding:'4px 0'}}>
                            <span style={{color:t.text}}>{r.service_date}</span>
                            <span style={{color:t.sub}}>{r.entries_count} assigned{r.published?'':' · draft'}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
        <div style={{overflowX:'auto'}}>
        <table style={{width:'100%',borderCollapse:'collapse'}}>
          <thead>
            <tr>
              <th style={{textAlign:'left',padding:'6px 8px',fontSize:10,color:t.sub,textTransform:'uppercase'}}>Department</th>
              <th style={{textAlign:'left',padding:'6px 8px',fontSize:10,color:t.sub,textTransform:'uppercase'}}>Workforce</th>
              <th style={{textAlign:'left',padding:'6px 8px',fontSize:10,color:t.sub,textTransform:'uppercase'}}>Next Service</th>
              <th style={{textAlign:'left',padding:'6px 8px',fontSize:10,color:t.sub,textTransform:'uppercase'}}>Status</th>
            </tr>
          </thead>
          <tbody>
            {data.department_stats.map(d=>(
              <React.Fragment key={d.id}>
                <tr onClick={()=>setExpandedDept(v=>v===d.id?null:d.id)} style={{borderTop:`0.5px solid ${t.border}`,cursor:'pointer',background:expandedDept===d.id?t.purpleBg:'transparent'}}>
                  <td style={{padding:'8px',fontSize:12,color:t.text,fontWeight:expandedDept===d.id?600:400}}>{expandedDept===d.id?'▾ ':'▸ '}{d.name}</td>
                  <td style={{padding:'8px',fontSize:12,color:t.sub}}>{d.member_count}</td>
                  <td style={{padding:'8px',fontSize:12,color:t.sub}}>{d.next_roster_date ? `${d.next_roster_date} · ${d.assigned_next} assigned` : '—'}</td>
                  <td style={{padding:'8px'}}>
                    <span style={{fontSize:10,padding:'3px 9px',borderRadius:8,fontWeight:600,background:d.next_roster_coverage==='scheduled'?'#E1F5EE':'#FAECE7',color:d.next_roster_coverage==='scheduled'?'#085041':'#993C1D'}}>
                      {d.next_roster_coverage==='scheduled'?'Covered':'No roster yet'}
                    </span>
                  </td>
                </tr>
                {expandedDept===d.id && (
                  <tr>
                    <td colSpan={4} style={{padding:'0 8px 14px',background:t.purpleBg}}>
                      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14,paddingTop:6}}>
                        <div>
                          <div style={{fontSize:10,color:t.muted,textTransform:'uppercase',letterSpacing:'0.4px',marginBottom:6}}>Members ({d.members.length})</div>
                          {d.members.length===0 ? <div style={{fontSize:12,color:t.muted}}>No members assigned yet.</div> : d.members.map(m=>(
                            <div key={m.member_id} style={{display:'flex',justifyContent:'space-between',fontSize:12,padding:'4px 0'}}>
                              <span style={{color:t.text}}>{m.full_name}</span>
                              <span style={{color:t.sub}}>{m.reliability_score!=null?`${m.reliability_score.toFixed(1)} · ${m.total_attended}/${m.total_assigned}`:'No history'}</span>
                            </div>
                          ))}
                        </div>
                        <div>
                          <div style={{fontSize:10,color:t.muted,textTransform:'uppercase',letterSpacing:'0.4px',marginBottom:6}}>Recent rosters</div>
                          {d.recent_rosters.length===0 ? <div style={{fontSize:12,color:t.muted}}>No rosters yet.</div> : d.recent_rosters.map(r=>(
                            <div key={r.id} style={{display:'flex',justifyContent:'space-between',fontSize:12,padding:'4px 0'}}>
                              <span style={{color:t.text}}>{r.service_date}</span>
                              <span style={{color:t.sub}}>{r.entries_count} assigned{r.published?'':' · draft'}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
        </div>
        )}
      </div>

      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14}}>
        <div style={{background:t.card,border:`0.5px solid ${t.border}`,borderRadius:12,padding:'16px 18px'}}>
          <div style={{fontSize:13,fontWeight:600,color:t.text,marginBottom:12}}>Most Reliable Servers</div>
          {data.reliability_rankings.length===0 ? (
            <div style={{fontSize:12,color:t.muted}}>No serving history recorded yet.</div>
          ) : data.reliability_rankings.map((r,i)=>(
            <div key={r.member_id}>
              <div onClick={()=>setExpandedMember(v=>v===r.member_id?null:r.member_id)} style={{display:'flex',justifyContent:'space-between',padding:'7px 0',borderBottom:i<data.reliability_rankings.length-1&&expandedMember!==r.member_id?`0.5px solid ${t.border}`:'none',cursor:'pointer'}}>
                <span style={{fontSize:12,color:t.text}}>{expandedMember===r.member_id?'▾ ':'▸ '}{r.full_name}</span>
                <span style={{fontSize:12,color:t.purple,fontWeight:600}}>{r.reliability_score?.toFixed(1)} · {r.total_attended}/{r.total_assigned}</span>
              </div>
              {expandedMember===r.member_id && (
                <div style={{padding:'4px 0 10px 14px',fontSize:11,color:t.sub}}>
                  Serves in: {r.departments.map(d=>d.department_name).join(', ') || '—'}{r.last_served ? ` · Last served ${r.last_served}` : ''}
                </div>
              )}
            </div>
          ))}
        </div>
        <div style={{background:t.card,border:`0.5px solid ${t.border}`,borderRadius:12,padding:'16px 18px'}}>
          <div style={{fontSize:13,fontWeight:600,color:t.text,marginBottom:12}}>Overcommitted (3+ Departments)</div>
          {data.overcommitted.length===0 ? (
            <div style={{fontSize:12,color:t.muted}}>Nobody is currently spread across 3 or more departments.</div>
          ) : data.overcommitted.map(o=>(
            <div key={o.member_id}>
              <div onClick={()=>setExpandedMember(v=>v===o.member_id?null:o.member_id)} style={{display:'flex',justifyContent:'space-between',padding:'7px 0',fontSize:12,cursor:'pointer'}}>
                <span style={{color:t.text}}>{expandedMember===o.member_id?'▾ ':'▸ '}{o.full_name}</span>
                <span style={{color:t.coral}}>{o.department_count} departments</span>
              </div>
              {expandedMember===o.member_id && (
                <div style={{padding:'0 0 10px 14px',fontSize:11,color:t.sub}}>
                  {o.departments.map(d=>d.department_name).join(', ') || '—'}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const CREATABLE_ROLES: {value:string;label:string;refKind:'cell'|'fellowship'|'department'|null}[] = [
  {value:'cell_leader',label:'Cell Leader',refKind:'cell'},
  {value:'fellowship_head',label:'Fellowship Head',refKind:'fellowship'},
  {value:'department_head',label:'Department Head',refKind:'department'},
  {value:'care_team',label:'Follow-Up & Care Team',refKind:null},
  {value:'workforce',label:'Workforce',refKind:null},
  {value:'accounts',label:'Accounts',refKind:null},
  {value:'partnership',label:'Partnership',refKind:null},
  {value:'pa',label:'PA / Church Admin',refKind:null},
  {value:'overseer',label:'Overseer',refKind:null},
  {value:'lead_tech',label:'Lead Tech',refKind:null},
];

function TeamAccessPanel({t}: {t: Record<string,string>}) {
  const [users, setUsers] = React.useState<{id:string;full_name:string;email:string;role:string}[]>([]);
  const [invites, setInvites] = React.useState<{id:string;email:string;full_name:string;role:string;unit_name:string;used:boolean;expired:boolean;created_at:string}[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [q, setQ] = React.useState('');
  const [resetting, setResetting] = React.useState<string|null>(null);
  const [loggingInAs, setLoggingInAs] = React.useState<string|null>(null);
  const [issued, setIssued] = React.useState<{full_name:string;email:string;password:string}|null>(null);

  const [showAdd, setShowAdd] = React.useState(false);
  const [cellList, setCellList] = React.useState<{id:string;name:string}[]>([]);
  const [fellowshipList, setFellowshipList] = React.useState<{id:string;name:string}[]>([]);
  const [deptList, setDeptList] = React.useState<{id:string;name:string}[]>([]);
  const [newName, setNewName] = React.useState('');
  const [newEmail, setNewEmail] = React.useState('');
  const [newRole, setNewRole] = React.useState('cell_leader');
  const [newRefId, setNewRefId] = React.useState('');
  const [creating, setCreating] = React.useState(false);
  const [createError, setCreateError] = React.useState('');
  const [newLink, setNewLink] = React.useState('');
  const [copied, setCopied] = React.useState(false);

  function loadInvites() {
    fetch('/api/invites', { credentials: 'include' }).then(r=>r.json()).then(({data})=>setInvites(data?.invites||[])).catch(()=>{});
  }

  React.useEffect(() => {
    fetch('/api/admin/users', { credentials: 'include' })
      .then(r => r.json())
      .then(({ data }) => setUsers(data?.users || []))
      .finally(() => setLoading(false));
    loadInvites();
    fetch('/api/cells/all', { credentials: 'include' }).then(r=>r.json()).then(({data})=>setCellList((data?.cells||[]).map((c:{id:string;cell:string})=>({id:c.id,name:c.cell})))).catch(()=>{});
    fetch('/api/fellowships/all', { credentials: 'include' }).then(r=>r.json()).then(({data})=>setFellowshipList(data?.fellowships||[])).catch(()=>{});
    fetch('/api/departments/all', { credentials: 'include' }).then(r=>r.json()).then(({data})=>setDeptList(data?.departments||[])).catch(()=>{});
  }, []);

  async function doReset(u: {id:string;full_name:string;email:string}) {
    setResetting(u.id);
    try {
      const res = await fetch('/api/admin/reset-user-password', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ userId: u.id }),
      });
      const json = await res.json();
      if (res.ok && json.data) setIssued(json.data);
      else alert(json.error?.message || 'Failed to reset password');
    } catch { alert('Network error — password was not reset.'); }
    setResetting(null);
  }

  async function doLoginAs(u: {id:string;full_name:string}) {
    setLoggingInAs(u.id);
    try {
      const res = await fetch('/api/admin/login-as', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ userId: u.id }),
      });
      const json = await res.json();
      if (res.ok && json.data) window.location.href = json.data.path;
      else { alert(json.error?.message || 'Failed to log in as this user'); setLoggingInAs(null); }
    } catch { alert('Network error — could not log in as this user.'); setLoggingInAs(null); }
  }

  const selectedRoleDef = CREATABLE_ROLES.find(r=>r.value===newRole);
  const refOptions = selectedRoleDef?.refKind==='cell' ? cellList : selectedRoleDef?.refKind==='fellowship' ? fellowshipList : selectedRoleDef?.refKind==='department' ? deptList : [];

  async function doInvite() {
    if (!newName.trim() || !newEmail.trim()) { setCreateError('Name and email are required'); return; }
    if (selectedRoleDef?.refKind && !newRefId) { setCreateError(`Select a ${selectedRoleDef.refKind} to assign them to`); return; }
    setCreating(true); setCreateError(''); setNewLink('');
    try {
      const res = await fetch('/api/invites', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({
          full_name: newName.trim(), email: newEmail.trim(), role: newRole,
          cell_id: selectedRoleDef?.refKind==='cell' ? newRefId : null,
          fellowship_id: selectedRoleDef?.refKind==='fellowship' ? newRefId : null,
          department_id: selectedRoleDef?.refKind==='department' ? newRefId : null,
        }),
      });
      const json = await res.json();
      if (res.ok && json.data) {
        setNewLink(json.data.invite_link);
        setNewName(''); setNewEmail(''); setNewRefId('');
        loadInvites();
      } else setCreateError(json.error?.message || 'Failed to create invite');
    } catch { setCreateError('Network error — invite was not created.'); }
    setCreating(false);
  }

  async function revokeInvite(id: string) {
    try {
      await fetch(`/api/invites?id=${id}`, { method: 'DELETE', credentials: 'include' });
      loadInvites();
    } catch {}
  }

  function copyLink() {
    navigator.clipboard?.writeText(newLink).then(()=>{ setCopied(true); setTimeout(()=>setCopied(false),2000); }).catch(()=>{});
  }

  const filtered = users.filter(u => !q || u.full_name.toLowerCase().includes(q.toLowerCase()) || u.email.toLowerCase().includes(q.toLowerCase()));
  const pendingInvites = invites.filter(i => !i.used);

  return (
    <div style={{background:t.card,borderRadius:12,border:`0.5px solid ${t.border}`,padding:'18px 20px',marginTop:14}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:14,flexWrap:'wrap',gap:8}}>
        <div>
          <div style={{fontSize:16,fontWeight:700,color:t.text}}>Team & Access</div>
          <div style={{fontSize:12,color:t.sub,marginTop:2}}>Invite a leader missed in the import — they pick their own password from the link. &quot;Log in as&quot; gives you a real, full-access session as anyone (any cell leader, department head, admin) for testing — no password touched. &quot;Exit preview&quot; in your account menu brings you back.</div>
        </div>
        <div style={{display:'flex',gap:8}}>
          <button onClick={()=>{setShowAdd(v=>!v);setCreateError('');setNewLink('');}}
            style={{background:showAdd?t.purpleBg:'#534AB7',color:showAdd?t.purple:'#fff',border:'none',borderRadius:8,padding:'8px 14px',fontSize:12,fontWeight:600,cursor:'pointer'}}>
            {showAdd?'Cancel':'+ Invite team member'}
          </button>
          <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search name or email"
            style={{width:200,border:`0.5px solid ${t.border}`,borderRadius:8,padding:'8px 12px',fontSize:12,background:t.input,color:t.text,outline:'none',fontFamily:'inherit'}} />
        </div>
      </div>

      {showAdd && (
        <div style={{background:t.cardInner||t.input,borderRadius:10,border:`0.5px solid ${t.border}`,padding:14,marginBottom:14,display:'flex',flexDirection:'column',gap:10}}>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
            <input value={newName} onChange={e=>setNewName(e.target.value)} placeholder="Full name"
              style={{border:`0.5px solid ${t.border}`,borderRadius:8,padding:'9px 11px',fontSize:12,background:t.input,color:t.text,outline:'none'}} />
            <input value={newEmail} onChange={e=>setNewEmail(e.target.value)} placeholder="Email" type="email"
              style={{border:`0.5px solid ${t.border}`,borderRadius:8,padding:'9px 11px',fontSize:12,background:t.input,color:t.text,outline:'none'}} />
          </div>
          <div style={{display:'grid',gridTemplateColumns:selectedRoleDef?.refKind?'1fr 1fr':'1fr',gap:10}}>
            <select value={newRole} onChange={e=>{setNewRole(e.target.value);setNewRefId('');}}
              style={{border:`0.5px solid ${t.border}`,borderRadius:8,padding:'9px 11px',fontSize:12,background:t.input,color:t.text,outline:'none'}}>
              {CREATABLE_ROLES.map(r=>(<option key={r.value} value={r.value}>{r.label}</option>))}
            </select>
            {selectedRoleDef?.refKind && (
              <select value={newRefId} onChange={e=>setNewRefId(e.target.value)}
                style={{border:`0.5px solid ${t.border}`,borderRadius:8,padding:'9px 11px',fontSize:12,background:t.input,color:t.text,outline:'none'}}>
                <option value="">{`Assign to ${selectedRoleDef.refKind}...`}</option>
                {refOptions.map(o=>(<option key={o.id} value={o.id}>{o.name}</option>))}
              </select>
            )}
          </div>
          {createError && <div style={{background:'#FAECE7',color:'#993C1D',borderRadius:8,padding:'8px 12px',fontSize:12}}>{createError}</div>}
          {newLink && (
            <div style={{background:'rgba(45,212,170,0.1)',border:'0.5px solid rgba(45,212,170,0.3)',borderRadius:9,padding:'10px 12px',display:'flex',alignItems:'center',gap:10}}>
              <div style={{flex:1,fontSize:11,color:t.text,wordBreak:'break-all',fontFamily:'monospace'}}>{newLink}</div>
              <button onClick={copyLink} style={{background:'#1D9E75',color:'#fff',border:'none',borderRadius:7,padding:'6px 12px',fontSize:11,fontWeight:600,cursor:'pointer',whiteSpace:'nowrap'}}>{copied?'Copied!':'Copy link'}</button>
            </div>
          )}
          <button onClick={doInvite} disabled={creating}
            style={{background:'#1D9E75',color:'#fff',border:'none',borderRadius:8,padding:'9px 14px',fontSize:12,fontWeight:600,cursor:creating?'wait':'pointer',alignSelf:'flex-start'}}>
            {creating?'Sending…':'Generate invite link'}
          </button>
        </div>
      )}

      {pendingInvites.length > 0 && (
        <div style={{marginBottom:14}}>
          <div style={{fontSize:11,color:t.muted,textTransform:'uppercase',letterSpacing:'0.5px',marginBottom:6}}>Pending invites ({pendingInvites.length})</div>
          {pendingInvites.map(inv => (
            <div key={inv.id} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'6px 0',borderBottom:`0.5px solid ${t.border}`,fontSize:12}}>
              <span style={{color:t.text}}>{inv.full_name} <span style={{color:t.muted}}>— {inv.role.replace('_',' ')}{inv.unit_name!=='—'?` · ${inv.unit_name}`:''}</span></span>
              <span style={{display:'flex',alignItems:'center',gap:8}}>
                {inv.expired && <span style={{color:t.coral,fontSize:10}}>Expired</span>}
                <button onClick={()=>revokeInvite(inv.id)} style={{background:'transparent',border:`0.5px solid ${t.border}`,borderRadius:6,padding:'3px 9px',fontSize:10,color:t.sub,cursor:'pointer'}}>Revoke</button>
              </span>
            </div>
          ))}
        </div>
      )}

      {issued && (
        <div style={{background:'rgba(45,212,170,0.1)',border:'0.5px solid rgba(45,212,170,0.3)',borderRadius:9,padding:'12px 14px',marginBottom:14,display:'flex',alignItems:'center',justifyContent:'space-between',gap:12}}>
          <div style={{fontSize:12,color:t.text}}>
            New password for <strong>{issued.full_name}</strong> ({issued.email}): <span style={{fontFamily:'monospace',fontWeight:700,fontSize:13}}>{issued.password}</span>
            <div style={{fontSize:11,color:t.sub,marginTop:2}}>Read this to them now — it will not be shown again.</div>
          </div>
          <button onClick={()=>setIssued(null)} style={{background:'transparent',border:'none',color:t.sub,cursor:'pointer',fontSize:16}}>×</button>
        </div>
      )}

      {loading ? (
        <div style={{fontSize:12,color:t.sub}}>Loading team…</div>
      ) : (
        <div style={{maxHeight:360,overflowY:'auto'}}>
          <table style={{width:'100%',borderCollapse:'collapse'}}>
            <thead>
              <tr>
                <th style={{textAlign:'left',padding:'6px 8px',fontSize:10,color:t.sub,textTransform:'uppercase'}}>Name</th>
                <th style={{textAlign:'left',padding:'6px 8px',fontSize:10,color:t.sub,textTransform:'uppercase'}}>Email</th>
                <th style={{textAlign:'left',padding:'6px 8px',fontSize:10,color:t.sub,textTransform:'uppercase'}}>Role</th>
                <th style={{textAlign:'right',padding:'6px 8px',fontSize:10,color:t.sub,textTransform:'uppercase'}}>Action</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(u => (
                <tr key={u.id} style={{borderTop:`0.5px solid ${t.border}`}}>
                  <td style={{padding:'8px',fontSize:12,color:t.text}}>{u.full_name}</td>
                  <td style={{padding:'8px',fontSize:12,color:t.sub}}>{u.email}</td>
                  <td style={{padding:'8px',fontSize:12,color:t.sub}}>{u.role}</td>
                  <td style={{padding:'8px',textAlign:'right',whiteSpace:'nowrap'}}>
                    <button onClick={()=>doLoginAs(u)} disabled={loggingInAs===u.id||!u.id}
                      style={{background:t.purple,border:'none',borderRadius:7,padding:'5px 11px',fontSize:11,color:'#fff',cursor:loggingInAs===u.id?'wait':'pointer',fontFamily:'inherit',marginRight:6}}>
                      {loggingInAs===u.id?'Logging in…':'Log in as'}
                    </button>
                    <button onClick={()=>doReset(u)} disabled={resetting===u.id}
                      style={{background:'transparent',border:`0.5px solid ${t.border}`,borderRadius:7,padding:'5px 11px',fontSize:11,color:t.text,cursor:resetting===u.id?'wait':'pointer',fontFamily:'inherit'}}>
                      {resetting===u.id?'Resetting…':'Reset password'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function ChurchSettingsPanel({t, dark, userRole, onConfigSaved}: {t: Record<string,string>; dark: boolean; userRole?: string; onConfigSaved?: (cfg:{structure_type:string;tier1_label:string|null;tier2_label:string|null;tier1_head_label:string;tier2_head_label:string;church_name:string;currency:string})=>void}) {
  const [config, setConfig] = React.useState<Record<string,unknown>>({});
  const [saving, setSaving] = React.useState(false);
  const [saved, setSaved] = React.useState(false);
  const [activeTab, setActiveTab] = React.useState<'structure'|'church'|'services'>('structure');
  const [originalStructureType, setOriginalStructureType] = React.useState('cell_church');
  const [showStructureConfirm, setShowStructureConfirm] = React.useState(false);

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
    fetch('/api/settings/church-config', { credentials: 'include' })
      .then(r => r.json())
      .then(({ data }) => {
        if (data?.config) {
          const c = data.config;
          setConfig(c);
          setChurchName(c.church_name || '');
          setStructureType(c.structure_type || 'cell_church');
          setOriginalStructureType(c.structure_type || 'cell_church');
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

  async function doSave() {
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
      setOriginalStructureType(structureType);
      onConfigSaved?.({ structure_type: structureType, tier1_label: tier1Label || null, tier2_label: tier2Label || null, tier1_head_label: tier1HeadLabel, tier2_head_label: tier2HeadLabel, church_name: churchName, currency });
    } catch {}
    setSaving(false);
  }

  function save() {
    // Changing the structure model reorganises how fellowships/cells/departments are
    // reported and displayed across the whole system — confirm before applying it.
    if (structureType !== originalStructureType) { setShowStructureConfirm(true); return; }
    doSave();
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
      {showStructureConfirm && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',backdropFilter:'blur(2px)',zIndex:200,display:'flex',alignItems:'center',justifyContent:'center',padding:16}}>
          <div style={{background:dark?'#151030':'#fff',borderRadius:16,padding:24,maxWidth:420,width:'100%',boxShadow:'0 20px 60px rgba(0,0,0,0.4)'}}>
            <div style={{fontSize:16,fontWeight:700,color:t.text,marginBottom:10}}>Change church structure?</div>
            <div style={{fontSize:13,color:t.muted,lineHeight:1.6,marginBottom:18}}>
              You are switching from <strong>{STRUCTURES.find(s=>s.value===originalStructureType)?.label||originalStructureType}</strong> to <strong>{STRUCTURES.find(s=>s.value===structureType)?.label||structureType}</strong>.
              This can alter how fellowships, cells, and departments are organised and reported across the whole system — some tabs and reports may change or disappear immediately. Existing records are not deleted, but how they are grouped and displayed will change right away.
              Do you still want to proceed, or would you rather contact support first?
            </div>
            <div style={{display:'flex',flexDirection:'column',gap:8}}>
              <button onClick={()=>{setShowStructureConfirm(false);doSave();}} style={{background:t.purple,color:'#fff',border:'none',borderRadius:9,padding:'10px',fontSize:13,fontWeight:600,cursor:'pointer'}}>Yes, proceed with the change</button>
              <button onClick={()=>{setShowStructureConfirm(false);window.open('mailto:support@shepherd.app?subject=Church%20structure%20change','_blank');}} style={{background:t.purpleBg||'#EEEDFE',color:t.purple,border:'none',borderRadius:9,padding:'10px',fontSize:13,fontWeight:600,cursor:'pointer'}}>Contact support first</button>
              <button onClick={()=>{setShowStructureConfirm(false);setStructureType(originalStructureType);}} style={{background:'transparent',color:t.muted,border:`0.5px solid ${t.border}`,borderRadius:9,padding:'10px',fontSize:13,cursor:'pointer'}}>Cancel</button>
            </div>
          </div>
        </div>
      )}
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
          <div style={{marginTop:6,fontSize:11,color:t.muted}}>
            This is the church-wide default. Branches can run their own schedule below — different days, or more than one service in a day.
          </div>
        </div>
      )}
      {activeTab === 'services' && ['overseer','general_overseer','branch_pastor','lead_tech'].includes(userRole||'') && (
        <BranchScheduleEditor t={t} userRole={userRole||''} allDays={DAYS} />
      )}
    </div>
  );
}

type BranchRow = {id:string;name:string;service_days:string[];day_service_counts:Record<string,number>};

function BranchScheduleEditor({t, userRole, allDays}: {t: Record<string,string>; userRole: string; allDays: string[]}) {
  const [branches, setBranches] = React.useState<BranchRow[]>([]);
  const [selectedId, setSelectedId] = React.useState('');
  const [days, setDays] = React.useState<string[]>(['Sunday']);
  const [counts, setCounts] = React.useState<Record<string,number>>({Sunday:1});
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [saved, setSaved] = React.useState(false);
  const [showCreate, setShowCreate] = React.useState(false);

  function load() {
    setLoading(true);
    fetch('/api/branches', { credentials: 'include' }).then(r=>r.json()).then(({data})=>{
      const list: BranchRow[] = data?.branches || [];
      setBranches(list);
      setSelectedId(prev => list.some(b=>b.id===prev) ? prev : (list[0]?.id || ''));
    }).finally(()=>setLoading(false));
  }
  React.useEffect(() => { load(); }, []);

  React.useEffect(() => {
    const b = branches.find(x => x.id === selectedId);
    if (b) {
      const d = b.service_days?.length ? b.service_days : ['Sunday'];
      setDays(d);
      const c: Record<string,number> = {};
      d.forEach(day => { c[day] = b.day_service_counts?.[day] || 1; });
      setCounts(c);
    }
  }, [selectedId, branches]);

  function toggleDay(day: string) {
    setDays(prev => {
      if (prev.includes(day)) return prev.filter(d=>d!==day);
      setCounts(c => ({...c, [day]: c[day] || 1}));
      return [...prev, day];
    });
  }

  async function save() {
    setSaving(true);
    try {
      const res = await fetch('/api/branches', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ id: selectedId, service_days: days, day_service_counts: counts }),
      });
      if (res.ok) {
        setSaved(true); setTimeout(()=>setSaved(false), 3000);
        setBranches(prev => prev.map(b => b.id === selectedId ? { ...b, service_days: days, day_service_counts: counts } : b));
      }
    } catch {}
    setSaving(false);
  }

  if (loading) return null;

  return (
    <div style={{background:t.card,border:`0.5px solid ${t.border}`,borderRadius:12,padding:'18px 20px'}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:2}}>
        <div style={{fontSize:13,fontWeight:600,color:t.text}}>Branch Schedule</div>
        {userRole !== 'branch_pastor' && (
          <button onClick={()=>setShowCreate(true)} style={{background:t.purpleBg,color:t.purple,border:'none',borderRadius:8,padding:'6px 12px',fontSize:12,fontWeight:600,cursor:'pointer'}}>+ Create Branch</button>
        )}
      </div>
      <div style={{fontSize:12,color:t.muted,marginBottom:14}}>Each branch can run its own service days, and its own number of services on each of those days (e.g. 3 Sunday services but only 1 midweek service) — a branch pastor only ever edits their own branch.</div>

      {showCreate && <CreateBranchModal t={t} allDays={allDays} onClose={()=>setShowCreate(false)} onCreated={()=>{setShowCreate(false);load();}} />}

      {branches.length === 0 ? (
        <div style={{fontSize:12,color:t.muted}}>No branches yet — create one to configure its schedule.</div>
      ) : (
        <>
          {userRole !== 'branch_pastor' && branches.length > 1 && (
            <select value={selectedId} onChange={e=>setSelectedId(e.target.value)}
              style={{border:`0.5px solid ${t.border}`,borderRadius:8,padding:'8px 12px',fontSize:13,background:t.input,color:t.text,outline:'none',marginBottom:14}}>
              {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          )}

          <div style={{fontSize:11,color:t.muted,textTransform:'uppercase',letterSpacing:'0.4px',marginBottom:8}}>Service days</div>
          <div style={{display:'flex',gap:8,flexWrap:'wrap' as const,marginBottom:16}}>
            {allDays.map(day => (
              <button key={day} onClick={()=>toggleDay(day)}
                style={{padding:'7px 14px',borderRadius:20,border:`0.5px solid ${days.includes(day)?t.purple:t.border}`,background:days.includes(day)?t.purple:t.input,color:days.includes(day)?'#fff':t.sub,fontSize:12,fontWeight:days.includes(day)?600:400,cursor:'pointer'}}>
                {day}
              </button>
            ))}
          </div>

          {days.length > 0 && (
            <>
              <div style={{fontSize:11,color:t.muted,textTransform:'uppercase',letterSpacing:'0.4px',marginBottom:8}}>Services per day</div>
              <div style={{display:'flex',flexDirection:'column',gap:8,marginBottom:8}}>
                {days.map(day => (
                  <div key={day} style={{display:'flex',alignItems:'center',gap:10}}>
                    <span style={{fontSize:12,color:t.text,width:90}}>{day}</span>
                    <input type="number" min={1} max={10} value={counts[day]||1}
                      onChange={e=>setCounts(c=>({...c,[day]:Math.max(1,Math.min(10,Number(e.target.value)||1))}))}
                      style={{width:70,border:`0.5px solid ${t.border}`,borderRadius:8,padding:'6px 10px',fontSize:13,background:t.input,color:t.text,outline:'none'}} />
                    <span style={{fontSize:11,color:t.muted}}>service{counts[day]>1?'s':''}</span>
                  </div>
                ))}
              </div>
              <div style={{fontSize:11,color:t.muted,marginBottom:6}}>e.g. Sunday = 3 services, Wednesday = 1 — attendance submission on each date will offer exactly that many.</div>
            </>
          )}

          <button onClick={save} disabled={saving || days.length===0}
            style={{marginTop:10,background:t.purple,color:'#fff',border:'none',borderRadius:9,padding:'9px 18px',fontSize:13,fontWeight:600,cursor:saving?'wait':'pointer',opacity:days.length===0?0.5:1}}>
            {saving ? 'Saving…' : saved ? '✓ Saved' : 'Save branch schedule'}
          </button>
        </>
      )}
    </div>
  );
}

function CreateBranchModal({t, allDays, onClose, onCreated}: {t: Record<string,string>; allDays: string[]; onClose: ()=>void; onCreated: ()=>void}) {
  const [name, setName] = React.useState('');
  const [days, setDays] = React.useState<string[]>(['Sunday']);
  const [counts, setCounts] = React.useState<Record<string,number>>({Sunday:1});
  const [creating, setCreating] = React.useState(false);
  const [error, setError] = React.useState('');

  function toggleDay(day: string) {
    setDays(prev => {
      if (prev.includes(day)) return prev.filter(d=>d!==day);
      setCounts(c => ({...c, [day]: c[day] || 1}));
      return [...prev, day];
    });
  }

  async function create() {
    if (!name.trim()) { setError('Branch name is required.'); return; }
    if (days.length === 0) { setError('Select at least one service day.'); return; }
    setCreating(true); setError('');
    try {
      const res = await fetch('/api/branches', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ branches: [{ name: name.trim(), service_days: days, day_service_counts: counts }] }),
      });
      const json = await res.json();
      if (res.ok && (json.data?.branches?.length ?? 0) > 0) onCreated();
      else setError(json.error?.message || 'A branch with that name may already exist.');
    } catch { setError('Network error — branch was not created.'); }
    setCreating(false);
  }

  return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',zIndex:200,display:'flex',alignItems:'center',justifyContent:'center',padding:16}} onClick={()=>!creating&&onClose()}>
      <div onClick={e=>e.stopPropagation()} style={{background:t.card,borderRadius:16,padding:22,maxWidth:420,width:'100%',boxShadow:'0 20px 60px rgba(0,0,0,0.4)'}}>
        <div style={{fontSize:16,fontWeight:700,color:t.text,marginBottom:14}}>Create a new branch</div>
        <div style={{fontSize:10,color:t.muted,textTransform:'uppercase',letterSpacing:'0.4px',marginBottom:6}}>Branch name</div>
        <input value={name} onChange={e=>setName(e.target.value)} placeholder="e.g. Redemption Camp"
          style={{width:'100%',border:`0.5px solid ${t.border}`,borderRadius:8,padding:'9px 11px',fontSize:13,background:t.input,color:t.text,outline:'none',marginBottom:14,boxSizing:'border-box'}} />

        <div style={{fontSize:10,color:t.muted,textTransform:'uppercase',letterSpacing:'0.4px',marginBottom:8}}>Service days</div>
        <div style={{display:'flex',gap:8,flexWrap:'wrap' as const,marginBottom:14}}>
          {allDays.map(day => (
            <button key={day} onClick={()=>toggleDay(day)}
              style={{padding:'6px 12px',borderRadius:20,border:`0.5px solid ${days.includes(day)?t.purple:t.border}`,background:days.includes(day)?t.purple:t.input,color:days.includes(day)?'#fff':t.sub,fontSize:11,fontWeight:days.includes(day)?600:400,cursor:'pointer'}}>
              {day}
            </button>
          ))}
        </div>

        {days.length > 0 && (
          <>
            <div style={{fontSize:10,color:t.muted,textTransform:'uppercase',letterSpacing:'0.4px',marginBottom:8}}>Services per day</div>
            <div style={{display:'flex',flexDirection:'column',gap:8,marginBottom:16}}>
              {days.map(day => (
                <div key={day} style={{display:'flex',alignItems:'center',gap:10}}>
                  <span style={{fontSize:12,color:t.text,width:90}}>{day}</span>
                  <input type="number" min={1} max={10} value={counts[day]||1}
                    onChange={e=>setCounts(c=>({...c,[day]:Math.max(1,Math.min(10,Number(e.target.value)||1))}))}
                    style={{width:70,border:`0.5px solid ${t.border}`,borderRadius:8,padding:'6px 10px',fontSize:13,background:t.input,color:t.text,outline:'none'}} />
                </div>
              ))}
            </div>
          </>
        )}

        {error && <div style={{background:'#FAECE7',color:'#993C1D',borderRadius:8,padding:'8px 12px',fontSize:12,marginBottom:14}}>{error}</div>}

        <div style={{display:'flex',gap:8,justifyContent:'flex-end'}}>
          <button onClick={onClose} disabled={creating} style={{background:t.input,color:t.text,border:'none',borderRadius:8,padding:'9px 16px',fontSize:13,cursor:'pointer'}}>Cancel</button>
          <button onClick={create} disabled={creating} style={{background:t.purple,color:'#fff',border:'none',borderRadius:8,padding:'9px 16px',fontSize:13,fontWeight:600,cursor:creating?'wait':'pointer'}}>
            {creating ? 'Creating…' : 'Create & activate branch'}
          </button>
        </div>
      </div>
    </div>
  );
}

type MemberAddition = {id:string;full_name:string;phone:string;email?:string;gender:string;date_of_birth:string;join_date:string;status:string;submitted_by_name?:string;submitted_by_role?:string;source?:string;pastor_revoked?:boolean;pastor_revoke_reason?:string;created_member_id?:string;created_at:string};

function MemberApprovalPanel({t,dark}:{t:Record<string,string>;dark:boolean}) {
  const [additions, setAdditions] = React.useState<MemberAddition[]>([]);
  const [processing, setProcessing] = React.useState<Record<string,boolean>>({});
  const [revokeTarget, setRevokeTarget] = React.useState<string|null>(null);
  const [revokeComment, setRevokeComment] = React.useState('');
  const [filter, setFilter] = React.useState<'pending'|'approved'|'all'>('pending');
  const [error, setError] = React.useState('');

  function load() {
    fetch('/api/update/member-additions?scope=review', { credentials: 'include' })
      .then(r => r.json())
      .then(({ data }) => { if (data?.additions) setAdditions(data.additions); })
      .catch(() => {});
  }
  React.useEffect(() => { load(); }, []);

  async function act(id: string, action: 'approve' | 'reject' | 'revoke', comment?: string) {
    setProcessing(p => ({ ...p, [id]: true }));
    setError('');
    try {
      const res = await fetch('/api/update/member-additions', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ id, action, comment }),
      });
      if (!res.ok) {
        const e = await res.json().catch(()=>({}));
        setError(e?.error?.message || 'Action failed.');
      } else {
        load();
        setRevokeTarget(null); setRevokeComment('');
      }
    } catch { setError('Network error.'); }
    setProcessing(p => ({ ...p, [id]: false }));
  }

  const visible = additions.filter(a =>
    filter === 'all' ? true : filter === 'pending' ? a.status === 'pending' : a.status === 'approved' && !a.pastor_revoked
  );

  return (
    <div style={{background:t.card,border:`0.5px solid ${t.border}`,borderRadius:12,padding:'16px 18px',marginBottom:4}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:14,flexWrap:'wrap' as const,gap:8}}>
        <div style={{display:'flex',alignItems:'center',gap:8}}>
          <div style={{fontSize:13,fontWeight:600,color:t.text}}>Member Approvals</div>
          <span style={{fontSize:11,padding:'2px 8px',borderRadius:10,background:'#FAEEDA',color:'#633806',fontWeight:600}}>{additions.filter(a=>a.status==='pending').length} pending</span>
        </div>
        <div style={{display:'flex',gap:6}}>
          {(['pending','approved','all'] as const).map(f => (
            <button key={f} onClick={()=>setFilter(f)} style={{padding:'4px 10px',borderRadius:16,border:'none',fontSize:11,fontWeight:filter===f?600:400,background:filter===f?t.purple:'transparent',color:filter===f?'#fff':t.muted,cursor:'pointer',textTransform:'capitalize' as const}}>{f}</button>
          ))}
        </div>
      </div>
      {error && <div style={{background:'#FAECE7',color:'#993C1D',borderRadius:8,padding:'8px 12px',fontSize:12,marginBottom:10}}>{error}</div>}
      {visible.length === 0 ? (
        <div style={{fontSize:12,color:t.muted,textAlign:'center' as const,padding:'12px 0'}}>Nothing here.</div>
      ) : visible.map((a,i) => (
        <div key={a.id} style={{padding:'10px 0',borderBottom:i<visible.length-1?`0.5px solid ${t.border}`:'none'}}>
          <div style={{display:'flex',alignItems:'center',gap:10,flexWrap:'wrap' as const}}>
            <div style={{flex:1,minWidth:140}}>
              <div style={{fontSize:13,fontWeight:500,color:t.text}}>{a.full_name}</div>
              <div style={{fontSize:11,color:t.muted}}>{a.phone||'—'} · Submitted by {a.submitted_by_name||'—'} ({a.submitted_by_role||'—'}) · {new Date(a.created_at).toLocaleDateString()}</div>
            </div>
            <div style={{display:'flex',gap:6}}>
              {a.status==='pending' ? (
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
              ) : a.status==='approved' && !a.pastor_revoked ? (
                <>
                  <span style={{fontSize:11,padding:'4px 10px',borderRadius:8,background:'#E1F5EE',color:'#085041',fontWeight:500}}>✓ Live</span>
                  <button onClick={()=>{setRevokeTarget(a.id);setRevokeComment('');}}
                    style={{background:'transparent',color:t.coral||'#D85A30',border:`0.5px solid ${t.border}`,borderRadius:7,padding:'5px 12px',fontSize:11,fontWeight:500,cursor:'pointer'}}>
                    Revoke
                  </button>
                </>
              ) : a.pastor_revoked ? (
                <span style={{fontSize:11,padding:'4px 10px',borderRadius:8,background:'#FAECE7',color:'#993C1D',fontWeight:500}}>Revoked</span>
              ) : (
                <span style={{fontSize:11,padding:'4px 10px',borderRadius:8,background:'#FAECE7',color:'#993C1D',fontWeight:500}}>Rejected</span>
              )}
            </div>
          </div>
          {revokeTarget===a.id && (
            <div style={{marginTop:8,display:'flex',gap:8,alignItems:'center'}}>
              <input autoFocus value={revokeComment} onChange={e=>setRevokeComment(e.target.value)} placeholder="Reason for revoking (required)…"
                style={{flex:1,border:`0.5px solid ${t.border}`,borderRadius:7,padding:'7px 10px',fontSize:12,background:t.input,color:t.text,outline:'none'}}/>
              <button onClick={()=>act(a.id,'revoke',revokeComment)} disabled={!revokeComment.trim()||processing[a.id]}
                style={{background:'#D85A30',color:'#fff',border:'none',borderRadius:7,padding:'7px 12px',fontSize:11,fontWeight:600,cursor:'pointer',opacity:!revokeComment.trim()?0.5:1}}>
                Confirm revoke
              </button>
              <button onClick={()=>setRevokeTarget(null)} style={{background:'transparent',color:t.muted,border:'none',fontSize:11,cursor:'pointer'}}>Cancel</button>
            </div>
          )}
          {a.pastor_revoked && a.pastor_revoke_reason && (
            <div style={{marginTop:6,fontSize:11,color:t.muted,fontStyle:'italic'}}>Revoked: {a.pastor_revoke_reason}</div>
          )}
        </div>
      ))}
    </div>
  );
}

type MemberRemoval = {
  id:string;member_id:string|null;member_name:string;reason:string;
  recommended_by_name:string|null;recommended_by_role:string|null;
  status:'pending'|'approved'|'rejected';approved_at:string|null;approval_comment:string|null;
  pastor_revoked:boolean;pastor_revoke_reason:string|null;created_at:string;
};

function RemovalApprovalPanel({t,dark,userRole}:{t:Record<string,string>;dark:boolean;userRole:string}) {
  const [removals,setRemovals]=React.useState<MemberRemoval[]>([]);
  const [processing,setProcessing]=React.useState<Record<string,boolean>>({});
  const [revokeTarget,setRevokeTarget]=React.useState<string|null>(null);
  const [revokeComment,setRevokeComment]=React.useState('');
  const [filter,setFilter]=React.useState<'pending'|'approved'|'all'>('pending');
  const [error,setError]=React.useState('');

  function load(){
    fetch('/api/update/member-removals',{credentials:'include'})
      .then(r=>r.json()).then(({data})=>{if(data?.removals)setRemovals(data.removals);}).catch(()=>{});
  }
  React.useEffect(()=>{load();},[]);

  async function act(id:string,action:'approve'|'reject'|'revoke',comment?:string){
    setProcessing(p=>({...p,[id]:true}));setError('');
    try{
      const res=await fetch('/api/update/member-removals',{method:'PATCH',headers:{'Content-Type':'application/json'},credentials:'include',body:JSON.stringify({id,action,comment})});
      if(!res.ok){const e=await res.json().catch(()=>({}));setError(e?.error?.message||'Action failed.');}
      else{load();setRevokeTarget(null);setRevokeComment('');}
    }catch{setError('Network error.');}
    setProcessing(p=>({...p,[id]:false}));
  }

  const visible=removals.filter(r=>filter==='all'?true:filter==='pending'?r.status==='pending':r.status==='approved'&&!r.pastor_revoked);

  return (
    <div style={{background:t.card,border:`0.5px solid ${t.border}`,borderRadius:12,padding:'16px 18px',marginBottom:4}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:14,flexWrap:'wrap' as const,gap:8}}>
        <div style={{display:'flex',alignItems:'center',gap:8}}>
          <div style={{fontSize:13,fontWeight:600,color:t.text}}>Removal Requests</div>
          <span style={{fontSize:11,padding:'2px 8px',borderRadius:10,background:'#FAEEDA',color:'#633806',fontWeight:600}}>{removals.filter(r=>r.status==='pending').length} pending</span>
        </div>
        <div style={{display:'flex',gap:6}}>
          {(['pending','approved','all'] as const).map(f=>(
            <button key={f} onClick={()=>setFilter(f)} style={{padding:'4px 10px',borderRadius:16,border:'none',fontSize:11,fontWeight:filter===f?600:400,background:filter===f?t.purple:'transparent',color:filter===f?'#fff':t.muted,cursor:'pointer',textTransform:'capitalize' as const}}>{f}</button>
          ))}
        </div>
      </div>
      {error && <div style={{background:'#FAECE7',color:'#993C1D',borderRadius:8,padding:'8px 12px',fontSize:12,marginBottom:10}}>{error}</div>}
      {visible.length===0 ? (
        <div style={{fontSize:12,color:t.muted,textAlign:'center' as const,padding:'12px 0'}}>Nothing here.</div>
      ) : visible.map((r,i)=>(
        <div key={r.id} style={{padding:'10px 0',borderBottom:i<visible.length-1?`0.5px solid ${t.border}`:'none'}}>
          <div style={{display:'flex',alignItems:'center',gap:10,flexWrap:'wrap' as const}}>
            <div style={{flex:1,minWidth:180}}>
              <div style={{fontSize:13,fontWeight:500,color:t.text}}>{r.member_name}</div>
              <div style={{fontSize:11,color:t.muted}}>Recommended by {r.recommended_by_name||'—'} ({r.recommended_by_role||'—'}) · {new Date(r.created_at).toLocaleDateString()}</div>
              <div style={{fontSize:11,color:t.sub,marginTop:3,fontStyle:'italic'}}>&ldquo;{r.reason}&rdquo;</div>
            </div>
            <div style={{display:'flex',gap:6}}>
              {r.status==='pending' ? (
                <>
                  <button onClick={()=>act(r.id,'approve')} disabled={processing[r.id]}
                    style={{background:'#D85A30',color:'#fff',border:'none',borderRadius:7,padding:'5px 12px',fontSize:11,fontWeight:600,cursor:'pointer',opacity:processing[r.id]?0.6:1}}>
                    {processing[r.id]?'…':'Approve removal'}
                  </button>
                  <button onClick={()=>act(r.id,'reject')} disabled={processing[r.id]}
                    style={{background:'#E1F5EE',color:'#085041',border:'none',borderRadius:7,padding:'5px 12px',fontSize:11,fontWeight:600,cursor:'pointer',opacity:processing[r.id]?0.6:1}}>
                    Keep member
                  </button>
                </>
              ) : r.status==='approved' && !r.pastor_revoked ? (
                <>
                  <span style={{fontSize:11,padding:'4px 10px',borderRadius:8,background:'#FAECE7',color:'#993C1D',fontWeight:500}}>Removed</span>
                  {userRole==='overseer' && (
                    <button onClick={()=>{setRevokeTarget(r.id);setRevokeComment('');}}
                      style={{background:'transparent',color:t.purple,border:`0.5px solid ${t.border}`,borderRadius:7,padding:'5px 12px',fontSize:11,fontWeight:500,cursor:'pointer'}}>
                      Revoke
                    </button>
                  )}
                </>
              ) : r.pastor_revoked ? (
                <span style={{fontSize:11,padding:'4px 10px',borderRadius:8,background:'#E1F5EE',color:'#085041',fontWeight:500}}>Revoked — reinstated</span>
              ) : (
                <span style={{fontSize:11,padding:'4px 10px',borderRadius:8,background:'#E1F5EE',color:'#085041',fontWeight:500}}>Kept</span>
              )}
            </div>
          </div>
          {revokeTarget===r.id && (
            <div style={{marginTop:8,display:'flex',gap:8,alignItems:'center'}}>
              <input autoFocus value={revokeComment} onChange={e=>setRevokeComment(e.target.value)} placeholder="Reason for reinstating (required)…"
                style={{flex:1,border:`0.5px solid ${t.border}`,borderRadius:7,padding:'7px 10px',fontSize:12,background:t.input,color:t.text,outline:'none'}}/>
              <button onClick={()=>act(r.id,'revoke',revokeComment)} disabled={!revokeComment.trim()||processing[r.id]}
                style={{background:t.purple,color:'#fff',border:'none',borderRadius:7,padding:'7px 12px',fontSize:11,fontWeight:600,cursor:'pointer',opacity:!revokeComment.trim()?0.5:1}}>
                Confirm revoke
              </button>
              <button onClick={()=>setRevokeTarget(null)} style={{background:'transparent',color:t.muted,border:'none',fontSize:11,cursor:'pointer'}}>Cancel</button>
            </div>
          )}
          {r.pastor_revoked && r.pastor_revoke_reason && (
            <div style={{marginTop:6,fontSize:11,color:t.muted,fontStyle:'italic'}}>Revoke reason: {r.pastor_revoke_reason}</div>
          )}
        </div>
      ))}
    </div>
  );
}

function CreateMemberModal({t,dark,onClose,onCreated}:{t:Record<string,string>;dark:boolean;onClose:()=>void;onCreated:()=>void}) {
  const [firstName,setFirstName]=React.useState('');
  const [lastName,setLastName]=React.useState('');
  const [phone,setPhone]=React.useState('');
  const [address,setAddress]=React.useState('');
  const [dobMonth,setDobMonth]=React.useState('');
  const [dobDay,setDobDay]=React.useState('');
  const [dobYear,setDobYear]=React.useState('');
  const [occupation,setOccupation]=React.useState('');
  const [departmentId,setDepartmentId]=React.useState('');
  const [departments,setDepartments]=React.useState<{id:string;name:string}[]>([]);
  const [saving,setSaving]=React.useState(false);
  const [error,setError]=React.useState('');

  React.useEffect(()=>{
    fetch('/api/departments/all',{credentials:'include'}).then(r=>r.json()).then(({data})=>{
      if(data?.departments) setDepartments(data.departments.map((d:{id:string;name:string})=>({id:d.id,name:d.name})));
    }).catch(()=>{});
  },[]);

  async function submit(){
    if(!firstName.trim()||!lastName.trim()){setError('First and last name are required.');return;}
    setSaving(true);setError('');
    const date_of_birth = dobYear && dobMonth && dobDay ? `${dobYear}-${dobMonth.padStart(2,'0')}-${dobDay.padStart(2,'0')}` : (dobMonth && dobDay ? `2000-${dobMonth.padStart(2,'0')}-${dobDay.padStart(2,'0')}` : null);
    try{
      const res=await fetch('/api/members/create',{method:'POST',headers:{'Content-Type':'application/json'},credentials:'include',
        body:JSON.stringify({full_name:`${firstName.trim()} ${lastName.trim()}`,phone:phone||null,address:address||null,occupation:occupation||null,date_of_birth,department_id:departmentId||null})});
      if(!res.ok){const e=await res.json();setError(e?.error?.message||'Failed to create member.');setSaving(false);return;}
      onCreated();onClose();
    }catch{setError('Network error.');}
    setSaving(false);
  }

  const inputS:React.CSSProperties={width:'100%',border:`0.5px solid ${t.border}`,borderRadius:8,padding:'9px 11px',fontSize:13,background:t.input,color:t.text,outline:'none',fontFamily:'inherit',boxSizing:'border-box' as const};
  const labelS:React.CSSProperties={fontSize:10,color:t.muted,textTransform:'uppercase' as const,letterSpacing:'0.4px',marginBottom:5,display:'block'};

  return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',backdropFilter:'blur(2px)',zIndex:200,display:'flex',alignItems:'center',justifyContent:'center',padding:16}} onClick={onClose}>
      <div style={{background:dark?'#151030':'#fff',borderRadius:16,padding:24,maxWidth:440,width:'100%',maxHeight:'90vh',overflowY:'auto',boxShadow:'0 20px 60px rgba(0,0,0,0.4)'}} onClick={e=>e.stopPropagation()}>
        <div style={{fontSize:16,fontWeight:700,color:t.text,marginBottom:4}}>Create Member</div>
        <div style={{fontSize:12,color:t.muted,marginBottom:16}}>Created by you — goes live immediately, no approval needed.</div>
        {error && <div style={{background:'#FAECE7',color:'#993C1D',borderRadius:8,padding:'8px 12px',fontSize:12,marginBottom:12}}>{error}</div>}
        <div style={{display:'flex',flexDirection:'column',gap:12}}>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
            <div><label style={labelS}>First name *</label><input value={firstName} onChange={e=>setFirstName(e.target.value)} style={inputS}/></div>
            <div><label style={labelS}>Last name *</label><input value={lastName} onChange={e=>setLastName(e.target.value)} style={inputS}/></div>
          </div>
          <div><label style={labelS}>Phone</label><input value={phone} onChange={e=>setPhone(e.target.value)} style={inputS}/></div>
          <div><label style={labelS}>Address</label><input value={address} onChange={e=>setAddress(e.target.value)} style={inputS}/></div>
          <div>
            <label style={labelS}>Date of birth (day &amp; month matter most, for birthdays)</label>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:8}}>
              <input value={dobDay} onChange={e=>setDobDay(e.target.value.replace(/\D/g,'').slice(0,2))} placeholder="Day" style={inputS}/>
              <select value={dobMonth} onChange={e=>setDobMonth(e.target.value)} style={inputS}>
                <option value="">Month</option>
                {['01','02','03','04','05','06','07','08','09','10','11','12'].map((mNum,i)=><option key={mNum} value={mNum}>{['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][i]}</option>)}
              </select>
              <input value={dobYear} onChange={e=>setDobYear(e.target.value.replace(/\D/g,'').slice(0,4))} placeholder="Year (optional)" style={inputS}/>
            </div>
          </div>
          <div><label style={labelS}>Occupation</label><input value={occupation} onChange={e=>setOccupation(e.target.value)} style={inputS}/></div>
          <div>
            <label style={labelS}>Department (if any)</label>
            <select value={departmentId} onChange={e=>setDepartmentId(e.target.value)} style={inputS}>
              <option value="">None</option>
              {departments.map(d=><option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
          <div style={{display:'flex',gap:8,marginTop:6}}>
            <button onClick={submit} disabled={saving} style={{flex:1,background:t.purple,color:'#fff',border:'none',borderRadius:9,padding:'11px',fontSize:13,fontWeight:600,cursor:'pointer',opacity:saving?0.6:1}}>{saving?'Creating…':'Create member'}</button>
            <button onClick={onClose} style={{background:'transparent',color:t.muted,border:`0.5px solid ${t.border}`,borderRadius:9,padding:'11px 16px',fontSize:13,cursor:'pointer'}}>Cancel</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function CreateDepartmentModal({t,dark,onClose,onCreated}:{t:Record<string,string>;dark:boolean;onClose:()=>void;onCreated:()=>void}) {
  const [name,setName]=React.useState('');
  const [saving,setSaving]=React.useState(false);
  const [error,setError]=React.useState('');

  async function submit(){
    if(!name.trim()){setError('Department name is required.');return;}
    setSaving(true);setError('');
    try{
      const res=await fetch('/api/admin/departments/create',{method:'POST',headers:{'Content-Type':'application/json'},credentials:'include',body:JSON.stringify({name:name.trim()})});
      if(!res.ok){const e=await res.json();setError(e?.error?.message||'Failed to create department.');setSaving(false);return;}
      onCreated();onClose();
    }catch{setError('Network error.');}
    setSaving(false);
  }

  const inputS:React.CSSProperties={width:'100%',border:`0.5px solid ${t.border}`,borderRadius:8,padding:'9px 11px',fontSize:13,background:t.input,color:t.text,outline:'none',fontFamily:'inherit',boxSizing:'border-box' as const};
  const labelS:React.CSSProperties={fontSize:10,color:t.muted,textTransform:'uppercase' as const,letterSpacing:'0.4px',marginBottom:5,display:'block'};

  return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',backdropFilter:'blur(2px)',zIndex:200,display:'flex',alignItems:'center',justifyContent:'center',padding:16}} onClick={onClose}>
      <div style={{background:dark?'#151030':'#fff',borderRadius:16,padding:24,maxWidth:400,width:'100%',boxShadow:'0 20px 60px rgba(0,0,0,0.4)'}} onClick={e=>e.stopPropagation()}>
        <div style={{fontSize:16,fontWeight:700,color:t.text,marginBottom:16}}>Create Department</div>
        {error && <div style={{background:'#FAECE7',color:'#993C1D',borderRadius:8,padding:'8px 12px',fontSize:12,marginBottom:12}}>{error}</div>}
        <div style={{display:'flex',flexDirection:'column',gap:12}}>
          <div><label style={labelS}>Department name *</label><input value={name} onChange={e=>setName(e.target.value)} placeholder="e.g. Sound Engineers" style={inputS}/></div>
          <div style={{display:'flex',gap:8,marginTop:6}}>
            <button onClick={submit} disabled={saving} style={{flex:1,background:t.purple,color:'#fff',border:'none',borderRadius:9,padding:'11px',fontSize:13,fontWeight:600,cursor:'pointer',opacity:saving?0.6:1}}>{saving?'Creating…':'Create department'}</button>
            <button onClick={onClose} style={{background:'transparent',color:t.muted,border:`0.5px solid ${t.border}`,borderRadius:9,padding:'11px 16px',fontSize:13,cursor:'pointer'}}>Cancel</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function CreateCellModal({t,dark,onClose,onCreated}:{t:Record<string,string>;dark:boolean;onClose:()=>void;onCreated:()=>void}) {
  const [name,setName]=React.useState('');
  const [fellowshipId,setFellowshipId]=React.useState('');
  const [targetSize,setTargetSize]=React.useState('');
  const [fellowships,setFellowships]=React.useState<{id:string;name:string}[]>([]);
  const [saving,setSaving]=React.useState(false);
  const [error,setError]=React.useState('');

  React.useEffect(()=>{
    fetch('/api/fellowships/all',{credentials:'include'}).then(r=>r.json()).then(({data})=>{if(data?.fellowships)setFellowships(data.fellowships);}).catch(()=>{});
  },[]);

  async function submit(){
    if(!name.trim()){setError('Cell name is required.');return;}
    if(!fellowshipId){setError('A fellowship is required — a cell can\'t exist outside one.');return;}
    setSaving(true);setError('');
    try{
      const res=await fetch('/api/cells/create',{method:'POST',headers:{'Content-Type':'application/json'},credentials:'include',
        body:JSON.stringify({name:name.trim(),fellowship_id:fellowshipId,target_size:targetSize||null})});
      if(!res.ok){const e=await res.json();setError(e?.error?.message||'Failed to create cell.');setSaving(false);return;}
      onCreated();onClose();
    }catch{setError('Network error.');}
    setSaving(false);
  }

  const inputS:React.CSSProperties={width:'100%',border:`0.5px solid ${t.border}`,borderRadius:8,padding:'9px 11px',fontSize:13,background:t.input,color:t.text,outline:'none',fontFamily:'inherit',boxSizing:'border-box' as const};
  const labelS:React.CSSProperties={fontSize:10,color:t.muted,textTransform:'uppercase' as const,letterSpacing:'0.4px',marginBottom:5,display:'block'};

  return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',backdropFilter:'blur(2px)',zIndex:200,display:'flex',alignItems:'center',justifyContent:'center',padding:16}} onClick={onClose}>
      <div style={{background:dark?'#151030':'#fff',borderRadius:16,padding:24,maxWidth:400,width:'100%',boxShadow:'0 20px 60px rgba(0,0,0,0.4)'}} onClick={e=>e.stopPropagation()}>
        <div style={{fontSize:16,fontWeight:700,color:t.text,marginBottom:16}}>Create Cell</div>
        {error && <div style={{background:'#FAECE7',color:'#993C1D',borderRadius:8,padding:'8px 12px',fontSize:12,marginBottom:12}}>{error}</div>}
        <div style={{display:'flex',flexDirection:'column',gap:12}}>
          <div><label style={labelS}>Cell name *</label><input value={name} onChange={e=>setName(e.target.value)} placeholder="e.g. Overcomers" style={inputS}/></div>
          <div>
            <label style={labelS}>Fellowship *</label>
            <select value={fellowshipId} onChange={e=>setFellowshipId(e.target.value)} style={inputS}>
              <option value="">Select a fellowship...</option>
              {fellowships.map(f=><option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
          </div>
          <div><label style={labelS}>Target size (optional)</label><input value={targetSize} onChange={e=>setTargetSize(e.target.value.replace(/\D/g,''))} style={inputS}/></div>
          <div style={{display:'flex',gap:8,marginTop:6}}>
            <button onClick={submit} disabled={saving} style={{flex:1,background:t.purple,color:'#fff',border:'none',borderRadius:9,padding:'11px',fontSize:13,fontWeight:600,cursor:'pointer',opacity:saving?0.6:1}}>{saving?'Creating…':'Create cell'}</button>
            <button onClick={onClose} style={{background:'transparent',color:t.muted,border:`0.5px solid ${t.border}`,borderRadius:9,padding:'11px 16px',fontSize:13,cursor:'pointer'}}>Cancel</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function MergeCellsModal({t,dark,cells,onClose,onMerged}:{t:Record<string,string>;dark:boolean;cells:{id:string;cell:string;fel:string;members:number}[];onClose:()=>void;onMerged:()=>void}) {
  const [fellowship,setFellowship]=React.useState('');
  const [targetId,setTargetId]=React.useState('');
  const [sourceIds,setSourceIds]=React.useState<Set<string>>(new Set());
  const [saving,setSaving]=React.useState(false);
  const [error,setError]=React.useState('');
  const [result,setResult]=React.useState<{moved_members:number;merged_cells:number}|null>(null);

  const fellowships=Array.from(new Set(cells.map(c=>c.fel))).sort();
  const inFellowship=cells.filter(c=>c.fel===fellowship);

  function toggleSource(id:string){
    setSourceIds(prev=>{const next=new Set(prev);if(next.has(id))next.delete(id);else next.add(id);return next;});
  }

  async function submit(){
    if(!targetId||sourceIds.size===0){setError('Pick a target cell and at least one cell to merge into it.');return;}
    setSaving(true);setError('');
    try{
      const res=await fetch('/api/admin/cells/merge',{method:'POST',headers:{'Content-Type':'application/json'},credentials:'include',
        body:JSON.stringify({source_cell_ids:Array.from(sourceIds),target_cell_id:targetId})});
      const json=await res.json();
      if(res.ok){setResult(json.data);onMerged();}
      else setError(json.error?.message||'Failed to merge cells.');
    }catch{setError('Network error.');}
    setSaving(false);
  }

  const labelS:React.CSSProperties={fontSize:10,color:t.muted,textTransform:'uppercase' as const,letterSpacing:'0.4px',marginBottom:5,display:'block'};
  const inputS:React.CSSProperties={width:'100%',border:`0.5px solid ${t.border}`,borderRadius:8,padding:'9px 11px',fontSize:13,background:t.input,color:t.text,outline:'none',fontFamily:'inherit',boxSizing:'border-box' as const};

  return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',backdropFilter:'blur(2px)',zIndex:200,display:'flex',alignItems:'center',justifyContent:'center',padding:16}} onClick={onClose}>
      <div style={{background:dark?'#151030':'#fff',borderRadius:16,padding:24,maxWidth:440,width:'100%',maxHeight:'85vh',overflowY:'auto',boxShadow:'0 20px 60px rgba(0,0,0,0.4)'}} onClick={e=>e.stopPropagation()}>
        <div style={{fontSize:16,fontWeight:700,color:t.text,marginBottom:4}}>Merge Cells</div>
        <div style={{fontSize:11,color:t.muted,marginBottom:16}}>Move every member from one or more cells into a single target cell. The merged cells are deactivated, not deleted — their history stays intact.</div>
        {error && <div style={{background:'#FAECE7',color:'#993C1D',borderRadius:8,padding:'8px 12px',fontSize:12,marginBottom:12}}>{error}</div>}
        {result ? (
          <div>
            <div style={{background:'#E1F5EE',color:'#085041',borderRadius:8,padding:'10px 14px',fontSize:12,marginBottom:16}}>
              Moved {result.moved_members} member{result.moved_members===1?'':'s'} into the target cell and deactivated {result.merged_cells} cell{result.merged_cells===1?'':'s'}.
            </div>
            <button onClick={onClose} style={{width:'100%',background:t.purple,color:'#fff',border:'none',borderRadius:9,padding:'11px',fontSize:13,fontWeight:600,cursor:'pointer'}}>Done</button>
          </div>
        ) : (
          <div style={{display:'flex',flexDirection:'column',gap:12}}>
            <div>
              <label style={labelS}>Fellowship</label>
              <select value={fellowship} onChange={e=>{setFellowship(e.target.value);setTargetId('');setSourceIds(new Set());}} style={inputS}>
                <option value="">Select a fellowship...</option>
                {fellowships.map(f=><option key={f} value={f}>{f}</option>)}
              </select>
            </div>
            {fellowship && (
              <>
                <div>
                  <label style={labelS}>Keep this cell (target)</label>
                  <select value={targetId} onChange={e=>{setTargetId(e.target.value);setSourceIds(prev=>{const next=new Set(prev);next.delete(e.target.value);return next;});}} style={inputS}>
                    <option value="">Select...</option>
                    {inFellowship.map(c=><option key={c.id} value={c.id}>{c.cell} ({c.members} members)</option>)}
                  </select>
                </div>
                {targetId && (
                  <div>
                    <label style={labelS}>Merge these cells into it</label>
                    {inFellowship.filter(c=>c.id!==targetId).map(c=>(
                      <label key={c.id} style={{display:'flex',alignItems:'center',gap:8,padding:'6px 0',fontSize:12,color:t.text,cursor:'pointer'}}>
                        <input type="checkbox" checked={sourceIds.has(c.id)} onChange={()=>toggleSource(c.id)} />
                        {c.cell} ({c.members} members)
                      </label>
                    ))}
                  </div>
                )}
              </>
            )}
            <div style={{display:'flex',gap:8,marginTop:6}}>
              <button onClick={submit} disabled={saving||!targetId||sourceIds.size===0} style={{flex:1,background:t.coral,color:'#fff',border:'none',borderRadius:9,padding:'11px',fontSize:13,fontWeight:600,cursor:'pointer',opacity:saving||!targetId||sourceIds.size===0?0.6:1}}>{saving?'Merging…':'Merge cells'}</button>
              <button onClick={onClose} style={{background:'transparent',color:t.muted,border:`0.5px solid ${t.border}`,borderRadius:9,padding:'11px 16px',fontSize:13,cursor:'pointer'}}>Cancel</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function DashboardPage(){
  const router=useRouter();
  const [page,setPage]=useState<NavPage>('dashboard');
  React.useEffect(()=>{ if(page==='admin') router.push('/admin'); },[page,router]);
  // Deep-link support (e.g. /dashboard?page=validation from the /update
  // redirect for admin roles) — read once on mount, not via useSearchParams,
  // to avoid forcing a Suspense boundary around the whole page for one param.
  function applyDeepLink(search: string) {
    const requested = new URLSearchParams(search).get('page');
    if (requested === 'service_planner') { setPage('events'); setEventsSubTab('planner'); }
    else if (requested) setPage(requested as NavPage);
  }
  React.useEffect(()=>{ applyDeepLink(window.location.search); },[]);
  // Clicking a notification while already on /dashboard (e.g. a new prayer
  // request) updates the URL but doesn't remount this page, so the
  // mount-only reader above would never see it — NotificationBell
  // dispatches this event in that exact case.
  React.useEffect(() => {
    function onDeepLink(e: Event) {
      const link = (e as CustomEvent<string>).detail || '';
      applyDeepLink(link.split('?')[1] ? `?${link.split('?')[1]}` : '');
    }
    window.addEventListener('shepherd:deep-link', onDeepLink);
    return () => window.removeEventListener('shepherd:deep-link', onDeepLink);
  }, []);
  const [showAlertOnly,setShowAlertOnly]=useState(false);
  const [churchConfig,setChurchConfig]=React.useState<{structure_type:string;tier1_label:string|null;tier2_label:string|null;tier1_head_label:string;tier2_head_label:string;church_name:string;currency:string}>({structure_type:'cell_church',tier1_label:'Fellowship',tier2_label:'Cell',tier1_head_label:'Fellowship Head',tier2_head_label:'Cell Leader',church_name:'',currency:'NGN'});
  const [kpi,setKpi]=useState<KPI|null>(null);
  const [branchesList,setBranchesList]=useState<{id:string;name:string;is_headquarters:boolean}[]>([]);
  const [selectedBranch,setSelectedBranch]=useState('');
  const [userName,setUserName]=useState('');
  const [userRole,setUserRole]=useState('');
  const [userBranchId,setUserBranchId]=useState('');
  const [eventsSubTab,setEventsSubTab]=useState<'planner'|'programs'>('planner');
  const [selectedCell,setSelectedCell]=useState<CellRow|null>(null);
  const [cellFilter,setCellFilter]=useState<string>('all');
  const [memberSearch,setMemberSearch]=useState('');
  const memberSearchRef=useRef<HTMLInputElement>(null);
  const [memberFilter,setMemberFilter]=useState('all');
  const [membersList,setMembersList]=useState<{id:string;full_name:string;phone:string;membership_status:string;join_date:string|null;cell_name:string|null;fellowship_name:string|null}[]>([]);
  const [membersLoading,setMembersLoading]=useState(true);
  const [showCreateMember,setShowCreateMember]=useState(false);
  const [showCreateCell,setShowCreateCell]=useState(false);
  const [showMergeCells,setShowMergeCells]=useState(false);
  const [showCreateDept,setShowCreateDept]=useState(false);
  const [deptAddSearch,setDeptAddSearch]=useState('');
  const [deptAddResults,setDeptAddResults]=useState<{id:string;full_name:string}[]>([]);
  const [deptInviteName,setDeptInviteName]=useState('');
  const [deptInviteEmail,setDeptInviteEmail]=useState('');
  const [deptInvitePhone,setDeptInvitePhone]=useState('');
  const [deptInviteLink,setDeptInviteLink]=useState('');
  const [deptInviteError,setDeptInviteError]=useState('');
  const [deptInviteSending,setDeptInviteSending]=useState(false);
  const [deleteTarget,setDeleteTarget]=useState<{id:string;name:string}|null>(null);
  const [deleteConfirmText,setDeleteConfirmText]=useState('');
  const [deleting,setDeleting]=useState(false);
  const [moveTarget,setMoveTarget]=useState<{id:string;name:string}|null>(null);
  const [moveCellId,setMoveCellId]=useState('');
  const [moving,setMoving]=useState(false);
  const [moveError,setMoveError]=useState('');
  const [attDrill,setAttDrill]=useState<string|null>(null);
  type DeptRow = {id:string;name:string;leader:string;count:number;absent:number;present:number;rate:number|null;status:string;submitted:boolean};
  type DeptDetail = {department:{id:string;name:string};members:{id:string;name:string;phone:string|null;role:string;status:string|null}[];last_submission:string|null};
  const [deptsList,setDeptsList]=useState<DeptRow[]>([]);
  const [deptsLoading,setDeptsLoading]=useState(true);
  const [selectedDeptId,setSelectedDeptId]=useState<string|null>(null);
  const [deptDetail,setDeptDetail]=useState<DeptDetail|null>(null);
  const [deptDetailLoading,setDeptDetailLoading]=useState(false);
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
  const {dark, setDark} = useTheme();
  const [pageReady,setPageReady]=useState(false);
  const [sidebarStyle,setSidebarStyle]=useState<'light'|'dark'>('light');
  const [sidebarOpen,setSidebarOpen]=useState(false);
  const [sidebarCollapsed,setSidebarCollapsed]=useState(false);
  const [isMobile,setIsMobile]=useState(false);

  useEffect(()=>{
    try{ if(window.localStorage.getItem('shepherd-sidebar-collapsed')==='1') setSidebarCollapsed(true); }catch{}
  },[]);
  const toggleSidebarCollapsed=()=>{
    setSidebarCollapsed(v=>{
      const next=!v;
      try{ window.localStorage.setItem('shepherd-sidebar-collapsed', next?'1':'0'); }catch{}
      return next;
    });
  };
  const [dbCells,setDbCells]=useState<(CellRow & {last_meeting_date?:string|null;meeting_this_week?:boolean;meeting_sla_grade?:string|null;submission_sla_score?:number|null;meeting_sla_score?:number|null;accuracy?:number;overall_score?:number})[]|null>(null);
  const [leaderOptions,setLeaderOptions]=useState<{id:string;full_name:string;role:string}[]>([]);
  const [memberFellowshipId,setMemberFellowshipId]=useState('');
  const [memberFellowshipsList,setMemberFellowshipsList]=useState<{id:string;name:string}[]>([]);
  // Collapsed by default on small screens so a long member roll doesn't
  // force scrolling past it to reach anything below — expanded by default
  // on desktop where the table already has its own internal scroll box.
  const [membersExpanded,setMembersExpanded]=useState(()=>typeof window!=='undefined'?window.innerWidth>=768:true);
  const [commendType,setCommendType]=useState<'commendation'|'meeting'|'encouragement'|'announcement'>('commendation');
  const [commendScope,setCommendScope]=useState<'individual'|'fellowship'|'department'|'all'>('individual');
  const [commendFellowshipId,setCommendFellowshipId]=useState('');
  const [commendDepartmentId,setCommendDepartmentId]=useState('');
  const [commendLeader,setCommendLeader]=useState('');
  const [commendMsg,setCommendMsg]=useState('');
  const [commendSending,setCommendSending]=useState(false);
  const [commendError,setCommendError]=useState('');
  const [sentCommendations,setSentCommendations]=useState<{to:string;type:string;msg:string;time:string}[]>([]);
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
      if(data?.branch_id)setUserBranchId(data.branch_id);
      setPageReady(true);
    }).catch(()=>setPageReady(true));
    // Reload config fresh - especially after onboarding
    const urlParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
    const justOnboarded = urlParams?.get('onboarded') === '1';
    fetch('/api/settings/church-config' + (justOnboarded ? '?fresh=1' : ''), {credentials:'include', cache: justOnboarded ? 'no-store' : 'default'})
      .then(r=>r.json()).then(({data})=>{if(data?.config)setChurchConfig(data.config);}).catch(()=>{});
    if (justOnboarded && typeof window !== 'undefined') {
      window.history.replaceState({}, '', '/dashboard');
    }
    fetch('/api/branches',{credentials:'include'}).then(r=>r.ok?r.json():null).then(json=>{if(json?.data?.branches)setBranchesList(json.data.branches);}).catch(()=>{});

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

    return()=>clearInterval(interval);
  },[]);

  // Branch-scoped lists — re-fetch whenever the branch switcher changes.
  useEffect(()=>{
    const bq=selectedBranch?`?branch_id=${selectedBranch}`:'';
    setDeptsLoading(true);
    fetch(`/api/departments/all${bq}`,{credentials:'include'}).then(r=>r.json()).then(({data})=>{setDeptsList(data?.departments||[]);}).finally(()=>setDeptsLoading(false));
    fetch(`/api/cells/all${bq}`,{credentials:'include'}).then(r=>r.json()).then(({data})=>{setDbCells(data?.cells||[]);}).catch(()=>{});
    fetch(`/api/members/leaders${bq}`,{credentials:'include'}).then(r=>r.json()).then(({data})=>{setLeaderOptions(data?.leaders||[]);}).catch(()=>{});
    fetch(`/api/fellowships/all${bq}`,{credentials:'include'}).then(r=>r.json()).then(({data})=>{setMemberFellowshipsList(data?.fellowships||[]);}).catch(()=>{});
  },[selectedBranch]);

  useEffect(()=>{
    if(!selectedDeptId){setDeptDetail(null);return;}
    setDeptDetailLoading(true);
    fetch(`/api/departments/all?department_id=${selectedDeptId}`,{credentials:'include'}).then(r=>r.json()).then(({data})=>{if(data)setDeptDetail(data);}).finally(()=>setDeptDetailLoading(false));
  },[selectedDeptId]);

  const loadMembers=useCallback(()=>{
    setMembersLoading(true);
    const params=new URLSearchParams();
    if(memberSearch.trim().length>=2)params.set('q',memberSearch.trim());
    if(selectedBranch)params.set('branch_id',selectedBranch);
    if(memberFellowshipId)params.set('fellowship_id',memberFellowshipId);
    const qs=params.toString();
    const url=`/api/members/search${qs?`?${qs}`:''}`;
    fetch(url,{credentials:'include'}).then(r=>r.json()).then(({data})=>{
      setMembersList(data?.members||[]);
    }).catch(()=>{}).finally(()=>setMembersLoading(false));
  },[memberSearch,selectedBranch,memberFellowshipId]);
  useEffect(()=>{
    const handle=setTimeout(loadMembers, memberSearch?300:0);
    return()=>clearTimeout(handle);
  },[loadMembers]);

  // Autofocus the in-tab search box when landing on Members with nothing
  // typed yet (e.g. via the sidebar nav item). Skipped when memberSearch is
  // already non-empty — that means the topbar search box itself is what's
  // being typed into right now, and stealing focus mid-keystroke would be
  // exactly the "redirects me to another field" complaint this replaced.
  useEffect(()=>{
    if(page==='members' && !memberSearch) requestAnimationFrame(()=>memberSearchRef.current?.focus());
  },[page]);

  async function confirmDeleteMember(){
    if(!deleteTarget)return;
    setDeleting(true);
    try{
      const res=await fetch(`/api/update/members/${deleteTarget.id}`,{method:'DELETE',credentials:'include'});
      if(res.ok){setDeleteTarget(null);setDeleteConfirmText('');loadMembers();}
    }catch{}
    setDeleting(false);
  }

  async function confirmMove(){
    if(!moveTarget||!moveCellId)return;
    setMoving(true);setMoveError('');
    try{
      const res=await fetch(`/api/update/members/${moveTarget.id}`,{
        method:'PATCH',headers:{'Content-Type':'application/json'},credentials:'include',
        body:JSON.stringify({cell_id:moveCellId}),
      });
      if(res.ok){setMoveTarget(null);setMoveCellId('');loadMembers();}
      else{const json=await res.json().catch(()=>({}));setMoveError(json?.error?.message||'Failed to move member.');}
    }catch{setMoveError('Network error — member was not moved.');}
    setMoving(false);
  }

  function reloadCells(){
    const bq=selectedBranch?`?branch_id=${selectedBranch}`:'';
    fetch(`/api/cells/all${bq}`,{credentials:'include'}).then(r=>r.json()).then(({data})=>{
      setDbCells(data?.cells||[]);
    }).catch(()=>{});
  }

  function reloadDeptsList(){
    const bq=selectedBranch?`?branch_id=${selectedBranch}`:'';
    fetch(`/api/departments/all${bq}`,{credentials:'include'}).then(r=>r.json()).then(({data})=>{setDeptsList(data?.departments||[]);});
  }
  function reloadDeptDetail(){
    if(!selectedDeptId)return;
    fetch(`/api/departments/all?department_id=${selectedDeptId}`,{credentials:'include'}).then(r=>r.json()).then(({data})=>{if(data)setDeptDetail(data);});
  }

  // Structure changed (or loaded) while viewing the Cell Ministry tab, which no
  // longer applies — bounce to the dashboard rather than showing a dead tab.
  useEffect(()=>{
    if(churchConfig.structure_type!=='cell_church' && page==='cells'){
      setPage('dashboard');
    }
  },[churchConfig.structure_type,page]);

  useEffect(()=>{chatEndRef.current?.scrollIntoView({behavior:'smooth'});},[messages]);

  useEffect(()=>{
    const url=selectedBranch?`/api/analytics/dashboard?branch_id=${selectedBranch}`:'/api/analytics/dashboard';
    fetch(url,{credentials:'include'}).then(r=>r.json()).then(({data})=>{if(data)setKpi(data);}).catch(()=>{});
  },[selectedBranch]);

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
    nav:       dark?'rgba(8,6,24,0.72)':sidebarStyle==='dark'?'rgba(13,10,36,0.85)':'rgba(255,255,255,0.78)',
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
  const card=(e?:React.CSSProperties):React.CSSProperties=>({background:t.card,backdropFilter:'blur(14px) saturate(150%)',WebkitBackdropFilter:'blur(14px) saturate(150%)',border:`0.5px solid ${t.border}`,borderRadius:'var(--radius-md)',padding:isMobile?'12px 14px':'16px 20px',transition:'transform var(--motion-medium) var(--ease-out-expo), box-shadow var(--motion-medium) var(--ease-out-expo)',...e});
  const ss=(s:string)=>s==='rising'?{bg:'#E1F5EE',c:'#085041'}:s==='stable'?{bg:'#F3F4F6',c:'#374151'}:s==='watch'?{bg:'#FAEEDA',c:'#633806'}:{bg:'#FAECE7',c:'#993C1D'};

  const navGroups=[
    {label:'Overview', items:[
      {id:'dashboard' as NavPage,icon:'ti-layout-dashboard',label:'Dashboard'},
      {id:'action_board' as NavPage,icon:'ti-alert-triangle',label:'Action Board'},
      {id:'reports' as NavPage,icon:'ti-chart-bar',label:'Reports'},
    ]},
    {label:'People', items:[
      {id:'members' as NavPage,icon:'ti-users',label:'Members'},
      {id:'departments' as NavPage,icon:'ti-building',label:'Departments'},
      {id:'attendance' as NavPage,icon:'ti-calendar-stats',label:'Attendance'},
      // The Cell Ministry tab only applies to the two-tier fellowship→cell structure —
      // hidden entirely for zonal/campus/department/house_network/single churches.
      ...(churchConfig.structure_type==='cell_church'?[{id:'cells' as NavPage,icon:'ti-circles',label:`${churchConfig.tier2_label||'Cell'} Ministry`}]:[]),
      {id:'validation' as NavPage,icon:'ti-checkbox',label:'Validate Records'},
    ]},
    {label:'Finance', items:[
      // Financial visibility is deliberately restricted for PA — they can
      // approve/query requisitions but not view giving/financial totals.
      ...(userRole!=='pa'?[{id:'giving' as NavPage,icon:'ti-coin',label:'Giving'}]:[]),
      {id:'requisitions' as NavPage,icon:'ti-receipt',label:'Requisitions'},
    ]},
    {label:'Ministry', items:[
      {id:'recognition' as NavPage,icon:'ti-award',label:'Recognition'},
      {id:'commendation' as NavPage,icon:'ti-star',label:'Commend Leaders'},
      {id:'prayer' as NavPage,icon:'ti-heart',label:'Prayer Requests'},
      {id:'care_followup' as NavPage,icon:'ti-heart-handshake',label:'Care & Follow-up'},
      {id:'workforce' as NavPage,icon:'ti-user-check',label:'Workforce'},
      {id:'events' as NavPage,icon:'ti-ticket',label:'Events & Service Planning'},
    ]},
    {label:'Admin', items:[
      {id:'settings' as NavPage,icon:'ti-settings',label:'Settings'},
      ...(userRole === 'lead_tech' ? [{id:'admin' as NavPage,icon:'ti-shield',label:'Admin Portal'}] : []),
    ]},
  ];
  const navItems=navGroups.flatMap(g=>g.items);
  // Curated primary shortcuts for the mobile bottom tab bar — the full
  // navGroups list stays reachable via the "More" tab's bottom sheet, so
  // this is a shortlist, not a compressed copy of the desktop sidebar.
  const bottomNavItems:{id:NavPage;icon:string;label:string}[]=[
    {id:'dashboard' as NavPage,icon:'ti-layout-dashboard',label:'Home'},
    {id:'members' as NavPage,icon:'ti-users',label:'Members'},
    ...(userRole!=='pa'?[{id:'giving' as NavPage,icon:'ti-coin',label:'Giving'}]:[{id:'requisitions' as NavPage,icon:'ti-receipt',label:'Requests'}]),
    {id:'action_board' as NavPage,icon:'ti-alert-triangle',label:'Alerts'},
  ];

  const agentOpts=[
    {id:'moshe' as AgentName,label:'Moshe',desc:'Church intelligence — all domains'},
  ];

  if(!pageReady) return <LoadingScreen dark={dark} label="Loading your dashboard…" />;

  return(
    <div data-theme={dark?'dark':'light'} data-sidebar={dark?'dark':sidebarStyle} style={{display:'flex',minHeight:'100vh',background:t.bg,fontFamily:'Inter,system-ui,sans-serif'}}>
      {/* Sidebar overlay for mobile */}
      {isMobile&&sidebarOpen&&<div onClick={()=>setSidebarOpen(false)} style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.3)',zIndex:40}}/>}
      {/* Sidebar */}
      <div style={{
          width:isMobile?'100%':(sidebarCollapsed?68:220),
          background:t.nav,
          borderRight:isMobile?undefined:`0.5px solid ${t.navBorder}`,
          borderTop:isMobile?`0.5px solid ${t.navBorder}`:undefined,
          borderRadius:isMobile?'20px 20px 0 0':0,
          display:'flex',flexDirection:'column',
          position:isMobile?'fixed':'sticky',
          top:isMobile?undefined:0,
          bottom:isMobile?0:undefined,
          left:0,
          height:isMobile?'80vh':'100vh',
          transform:isMobile?(sidebarOpen?'translateY(0)':'translateY(100%)'):undefined,
          flexShrink:0,zIndex:50,
          transition:isMobile?'transform 0.3s cubic-bezier(0.4,0,0.2,1)':'left 0.3s cubic-bezier(0.4,0,0.2,1), width 0.25s cubic-bezier(0.4,0,0.2,1)',
          backdropFilter:'blur(20px)',
          boxShadow:isMobile?'0 -8px 32px rgba(0,0,0,0.25)':undefined,
        }}>
        {isMobile&&<div style={{display:'flex',justifyContent:'center',padding:'10px 0 2px'}}><div style={{width:36,height:4,borderRadius:2,background:t.navBorder}}/></div>}
        {!isMobile&&<button onClick={toggleSidebarCollapsed} aria-label={sidebarCollapsed?'Expand sidebar':'Collapse sidebar'} style={{position:'absolute',top:22,right:-11,width:22,height:22,borderRadius:'50%',border:`0.5px solid ${t.navBorder}`,background:dark?'#2A2650':'#fff',color:dark?'#CFC9FF':'#534AB7',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',zIndex:51,boxShadow:'0 1px 4px rgba(0,0,0,0.15)',transition:'transform 0.25s ease'}}>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{transform:sidebarCollapsed?'rotate(180deg)':'none',transition:'transform 0.25s ease'}}><path d="M15 18l-6-6 6-6"/></svg>
        </button>}
        <div style={{display:'flex',alignItems:'center',gap:10,padding:sidebarCollapsed&&!isMobile?'16px 0 14px':'16px 16px 14px',justifyContent:sidebarCollapsed&&!isMobile?'center':'flex-start',borderBottom:`0.5px solid ${t.navBorder}`}}>
          <div style={{width:28,height:28,position:'relative',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}><div style={{position:'absolute',width:4,height:20,background:'#A89FFF',borderRadius:2}}/><div style={{position:'absolute',width:15,height:4,background:'#A89FFF',borderRadius:2}}/></div>
          {(!sidebarCollapsed||isMobile)&&<div style={{flex:1}}><div style={{fontSize:14,fontWeight:700,color:dark?'#E8E5FF':sidebarStyle==='dark'?'#FFFFFF':'#1A1040',letterSpacing:'1px',lineHeight:1,whiteSpace:'nowrap'}}>SHEP.HERD</div><div style={{fontSize:9,color:dark?'rgba(232,229,255,0.3)':sidebarStyle==='dark'?'rgba(255,255,255,0.35)':'#9990CC',marginTop:2,whiteSpace:'nowrap'}}>Church Intelligence</div></div>}
          {isMobile&&<button onClick={()=>setSidebarOpen(false)} aria-label="Close menu" style={{background:'none',border:'none',cursor:'pointer',color:t.muted,padding:4,display:'flex'}}><Icon name="ti-x" size={16}/></button>}
        </div>
        <nav style={{flex:1,padding:'8px 0',overflowY:'auto',overflowX:'hidden'}}>
          {navGroups.filter(g=>g.items.length>0).map(g=>(
            <div key={g.label} style={{marginBottom:4}}>
              {(!sidebarCollapsed||isMobile)&&<div style={{fontSize:9.5,fontWeight:700,letterSpacing:'0.08em',textTransform:'uppercase' as const,color:dark?'rgba(232,229,255,0.28)':sidebarStyle==='dark'?'rgba(255,255,255,0.28)':'#B4ACD9',padding:'10px 20px 4px',whiteSpace:'nowrap'}}>{g.label}</div>}
              {g.items.map(n=>(
                <button key={n.id} onClick={()=>{setSelectedCell(null);setSelectedDeptId(null);setPage(n.id);if(isMobile)setSidebarOpen(false);}}
                  className="sh-nav-item"
                  title={sidebarCollapsed&&!isMobile?n.label:undefined}
                  style={{
                    background: page===n.id ? (dark?'rgba(83,74,183,0.45)':'rgba(83,74,183,0.10)') : 'transparent',
                    color: page===n.id ? (dark?'#E8E5FF':'#3C3489') : undefined,
                    fontWeight: page===n.id ? 600 : 400,
                    borderLeft: `2px solid ${page===n.id?'#534AB7':'transparent'}`,
                    boxShadow: page===n.id ? (dark?'0 0 20px rgba(83,74,183,0.3), inset 0 0 0 0.5px rgba(168,159,255,0.2)':'0 0 12px rgba(83,74,183,0.10)') : 'none',
                    borderRadius: '0 8px 8px 0',
                    margin: '1px 8px 1px 0',
                    width: 'calc(100% - 8px)',
                    justifyContent: sidebarCollapsed&&!isMobile?'center':'flex-start',
                    transition: 'all 0.2s ease',
                  }}>
                  {n.icon && <Icon name={n.icon} size={15} style={{opacity:page===n.id?1:0.5,flexShrink:0}} />}
                  {(!sidebarCollapsed||isMobile)&&<span style={{whiteSpace:'nowrap',overflow:'hidden'}}>{n.label}</span>}
                </button>
              ))}
            </div>
          ))}
          {isMobile&&(
            <div style={{marginBottom:4}}>
              <div style={{fontSize:9.5,fontWeight:700,letterSpacing:'0.08em',textTransform:'uppercase' as const,color:dark?'rgba(232,229,255,0.28)':'#B4ACD9',padding:'10px 20px 4px',whiteSpace:'nowrap'}}>Quick Links</div>
              {[{label:'Church Feed',icon:'ti-speakerphone',href:'/church-feed'},{label:'Calendar',icon:'ti-calendar-event',href:'/calendar'}].map(l=>(
                <button key={l.href} onClick={()=>{setSidebarOpen(false);router.push(l.href);}}
                  className="sh-nav-item"
                  style={{background:'transparent',borderLeft:'2px solid transparent',borderRadius:'0 8px 8px 0',margin:'1px 8px 1px 0',width:'calc(100% - 8px)',transition:'all 0.2s ease'}}>
                  <Icon name={l.icon} size={15} style={{opacity:0.5,flexShrink:0}} />
                  <span style={{whiteSpace:'nowrap',overflow:'hidden'}}>{l.label}</span>
                </button>
              ))}
            </div>
          )}
        </nav>
        <div style={{padding:isMobile?'12px 12px calc(12px + env(safe-area-inset-bottom))':12,borderTop:`0.5px solid ${t.navBorder}`}}>
          <button onClick={()=>setChatOpen(v=>!v)} title={sidebarCollapsed&&!isMobile?'Ask AI Agents':undefined} style={{width:'100%',background:chatOpen?'#534AB7':'#EEEDFE',color:chatOpen?'#fff':'#3C3489',border:'none',borderRadius:8,padding:'8px 12px',fontSize:13,fontWeight:500,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:sidebarCollapsed&&!isMobile?'center':'flex-start',gap:8}}>
            {sidebarCollapsed&&!isMobile?<Icon name="ti-message-circle" size={15}/>:'Ask AI Agents'}
          </button>
          <button onClick={logout} title={sidebarCollapsed&&!isMobile?'Sign out':undefined} style={{width:'100%',background:'transparent',color:t.muted,border:'none',borderRadius:8,padding:'6px 12px',fontSize:12,cursor:'pointer',marginTop:4,display:'flex',justifyContent:sidebarCollapsed&&!isMobile?'center':'flex-start'}}>
            {sidebarCollapsed&&!isMobile?<Icon name="ti-logout" size={13}/>:'Sign out'}
          </button>
        </div>
      </div>

      {/* Mobile bottom tab bar — the real native-feeling primary nav on
          mobile, not a hidden hamburger drawer. "More" opens the full
          nav list as a bottom sheet (the sidebar div above, repurposed). */}
      {isMobile&&(
        <div style={{position:'fixed',bottom:0,left:0,right:0,height:60,paddingBottom:'env(safe-area-inset-bottom)',background:t.nav,borderTop:`0.5px solid ${t.navBorder}`,backdropFilter:'blur(20px) saturate(160%)',WebkitBackdropFilter:'blur(20px) saturate(160%)',display:'flex',alignItems:'stretch',zIndex:45}}>
          {bottomNavItems.map(n=>(
            <button key={n.id} onClick={()=>{setSelectedCell(null);setSelectedDeptId(null);setPage(n.id);setSidebarOpen(false);}} style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:3,background:'none',border:'none',cursor:'pointer',color:page===n.id&&!sidebarOpen?'#534AB7':t.muted,fontFamily:'inherit'}}>
              <Icon name={n.icon} size={19} style={{opacity:page===n.id&&!sidebarOpen?1:0.65}} />
              <span style={{fontSize:9.5,fontWeight:page===n.id&&!sidebarOpen?700:500}}>{n.label}</span>
            </button>
          ))}
          <button onClick={()=>setSidebarOpen(v=>!v)} style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:3,background:'none',border:'none',cursor:'pointer',color:sidebarOpen?'#534AB7':t.muted,fontFamily:'inherit'}}>
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{opacity:sidebarOpen?1:0.65}}><circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/></svg>
            <span style={{fontSize:9.5,fontWeight:sidebarOpen?700:500}}>More</span>
          </button>
        </div>
      )}
      {/* Main */}
      <div style={{flex:1,display:'flex',flexDirection:'column',minWidth:0,background:dark?`radial-gradient(circle at 15% 0%, rgba(83,74,183,0.12), transparent 45%), ${t.bg}`:`radial-gradient(circle at 15% 0%, rgba(83,74,183,0.06), transparent 45%), ${t.bg}`}}>
        {/* Topbar */}
        <div style={{background:t.nav,backdropFilter:'blur(18px) saturate(160%)',WebkitBackdropFilter:'blur(18px) saturate(160%)',borderBottom:`0.5px solid ${t.navBorder}`,padding:isMobile?'calc(10px + env(safe-area-inset-top)) 14px 10px':'14px 24px',display:'flex',alignItems:'center',justifyContent:'space-between',gap:8,position:'sticky',top:0,zIndex:30}}>
          <div style={{display:'flex',alignItems:'center',gap:isMobile?6:10,minWidth:0}}>
            <div style={{minWidth:0,overflow:'hidden',display:'flex',alignItems:'center',gap:10}}>
              <span style={{fontSize:isMobile?12:14,fontWeight:600,color:t.text,whiteSpace:'nowrap'}}>{navItems.find(n=>n.id===page)?.label}</span>
              {!isMobile&&<span style={{width:3,height:3,borderRadius:'50%',background:t.muted,opacity:0.5,flexShrink:0}}/>}
              {!isMobile&&<span suppressHydrationWarning style={{fontSize:11,color:t.muted,whiteSpace:'nowrap'}}>{new Date().toLocaleDateString('en-GB',{weekday:'long',day:'numeric',month:'long',year:'numeric'})}</span>}
              {!isMobile&&userName&&userName!=='General'&&<span style={{width:3,height:3,borderRadius:'50%',background:'#534AB7',opacity:0.5,flexShrink:0}}/>}
              {!isMobile&&userName&&userName!=='General'&&<span style={{fontSize:12,color:'#534AB7',whiteSpace:'nowrap'}}>{greeting()}, {greetingName(userName,userRole)}</span>}
            </div>
          </div>
          <div style={{display:'flex',alignItems:'center',gap:isMobile?6:12,flexShrink:0}}>
            {userRole==='branch_pastor' ? (
              <div title="You are scoped to your own branch — every figure and action here applies only to it"
                style={{display:'flex',alignItems:'center',gap:isMobile?5:7,padding:isMobile?'4px 8px':'6px 12px',borderRadius:20,border:'0.5px solid rgba(29,158,117,0.3)',background:dark?'rgba(29,158,117,0.12)':'#E1F5EE'}}>
                <span style={{width:7,height:7,borderRadius:'50%',background:'#1D9E75',flexShrink:0,boxShadow:'0 0 0 3px rgba(29,158,117,0.2)'}}/>
                {!isMobile&&<span style={{fontSize:11,fontWeight:700,color:'#085041'}}>Viewing: {branchesList.find(b=>b.id===userBranchId)?.name || 'Your Branch'}</span>}
              </div>
            ) : branchesList.length>1&&!isMobile&&(
              <div style={{position:'relative',display:'flex',alignItems:'center'}}>
                <div style={{position:'absolute',left:10,display:'flex',alignItems:'center',gap:6,pointerEvents:'none',zIndex:1}}>
                  <span style={{width:7,height:7,borderRadius:'50%',background:selectedBranch?'#BA7517':'#534AB7',flexShrink:0,boxShadow:`0 0 0 3px ${selectedBranch?'rgba(186,117,23,0.18)':'rgba(83,74,183,0.18)'}`}}/>
                </div>
                <select value={selectedBranch} onChange={e=>setSelectedBranch(e.target.value)}
                  title="Viewing scope — every figure and action on this page applies to whatever is selected here"
                  style={{border:`1px solid ${selectedBranch?'rgba(186,117,23,0.35)':'rgba(83,74,183,0.35)'}`,borderRadius:20,padding:'6px 12px 6px 22px',fontSize:11,fontWeight:700,background:selectedBranch?(dark?'rgba(186,117,23,0.12)':'#FAEEDA'):(dark?'rgba(83,74,183,0.12)':t.purpleBg),color:selectedBranch?'#633806':'#3C3489',outline:'none',fontFamily:'inherit',cursor:'pointer',appearance:'none' as const}}>
                  <option value="">Viewing: All Branches (Consolidated)</option>
                  {branchesList.map(b=>(<option key={b.id} value={b.id}>Viewing: {b.name}</option>))}
                </select>
              </div>
            )}
            {!isMobile&&!dark&&(<div style={{display:'flex',background:t.cardInner,border:`0.5px solid ${t.border}`,borderRadius:20,padding:2,gap:2}}><button onClick={()=>setSidebarStyle('light')} style={{padding:'4px 10px',borderRadius:16,fontSize:10,cursor:'pointer',border:'none',background:sidebarStyle==='light'?'#534AB7':'transparent',color:sidebarStyle==='light'?'#fff':t.muted,fontFamily:'inherit'}}>Light sidebar</button><button onClick={()=>setSidebarStyle('dark')} style={{padding:'4px 10px',borderRadius:16,fontSize:10,cursor:'pointer',border:'none',background:sidebarStyle==='dark'?'#534AB7':'transparent',color:sidebarStyle==='dark'?'#fff':t.muted,fontFamily:'inherit'}}>Dark sidebar</button></div>)}
            {!isMobile&&<input value={memberSearch} onChange={e=>{setMemberSearch(e.target.value); if(page!=='members') setPage('members');}} onFocus={()=>{ if(page!=='members') setPage('members'); }}
              placeholder="Search members..."
              style={{width:160,padding:'6px 12px',borderRadius:8,border:`0.5px solid ${t.navBorder}`,background:'transparent',fontSize:11,color:t.text,outline:'none',fontFamily:'inherit',transition:'width var(--motion-medium) var(--ease-out-expo), background var(--motion-fast) var(--ease-out-expo)'}}
              onFocusCapture={e=>{e.currentTarget.style.width='220px'; e.currentTarget.style.background=t.input;}}
              onBlurCapture={e=>{e.currentTarget.style.width='160px'; e.currentTarget.style.background='transparent';}} />}
            {!isMobile&&<button onClick={()=>setPage('members')} style={{display:'flex',alignItems:'center',gap:6,padding:'6px 12px',borderRadius:8,border:'none',background:'#534AB7',color:'#fff',fontSize:11,fontWeight:500,cursor:'pointer',fontFamily:'inherit'}}><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14"/></svg>Add member</button>}
            {/* Church Feed moves into the "More" sheet on mobile — an
                icon-only speaker glyph this small read as a mute/volume
                toggle sitting next to the theme switch, not "announcements". */}
            {!isMobile&&<button onClick={()=>router.push('/church-feed')} style={{display:'flex',alignItems:'center',gap:6,padding:'6px 12px',borderRadius:8,border:`0.5px solid ${t.navBorder}`,background:'transparent',fontSize:11,color:t.sub,cursor:'pointer',fontFamily:'inherit'}}><Icon name="ti-speakerphone" size={13}/>Church Feed</button>}
            <ChatNavButton t={t} compact={isMobile} />
            {!isMobile&&<button onClick={()=>router.push('/calendar')} style={{display:'flex',alignItems:'center',gap:6,padding:'6px 12px',borderRadius:8,border:`0.5px solid ${t.navBorder}`,background:'transparent',fontSize:11,color:t.sub,cursor:'pointer',fontFamily:'inherit'}}><Icon name="ti-calendar-event" size={13}/>Calendar</button>}
            <NotificationBell dark={dark} compact={isMobile} /><MyAccountButton dark={dark} compact={isMobile} />
            {!isMobile&&<div onClick={()=>setDark(v=>!v)} role="switch" aria-checked={dark} style={{width:50,height:28,borderRadius:14,border:`0.5px solid ${t.navBorder}`,background:dark?'linear-gradient(135deg,#3C3489,#534AB7)':'#EEEDFE',display:'flex',alignItems:'center',padding:2,cursor:'pointer',position:'relative',transition:'background 0.25s ease'}}>
              <div style={{width:22,height:22,borderRadius:'50%',background:dark?'#1A1730':'#fff',boxShadow:'0 1px 3px rgba(0,0,0,0.25)',display:'flex',alignItems:'center',justifyContent:'center',transform:dark?'translateX(22px)':'translateX(0)',transition:'transform 0.25s cubic-bezier(0.34,1.56,0.64,1)',color:dark?'#CFC9FF':'#8A7FD8'}}>
                {dark?<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>:<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>}
              </div>
            </div>}
            {!isMobile&&(
              <div style={{display:'flex',alignItems:'center',gap:5,fontSize:12,color:'#1D9E75'}}>
                <span style={{width:7,height:7,borderRadius:'50%',background:'#1D9E75',display:'inline-block'}}/>Live
              </div>
            )}
            {!isMobile&&<div style={{width:32,height:32,borderRadius:'50%',background:'#CECBF6',display:'flex',alignItems:'center',justifyContent:'center',fontSize:12,fontWeight:500,color:'#3C3489'}}>{userName?userName.slice(0,2).toUpperCase():'GO'}</div>}
          </div>
        </div>

        <div key={page} className="shep-tab-enter" style={{flex:1,padding:isMobile?'12px 12px calc(76px + env(safe-area-inset-bottom))':'20px',overflowY:'auto',background:'transparent',maxWidth:'100%'}}>

          {/* ══ DASHBOARD ══ */}
          {page==='dashboard'&&(
            <div>
              <div style={{background:'linear-gradient(135deg, #6C5FC7 0%, #534AB7 55%, #3C3489 100%)',borderRadius:'var(--radius-lg)',padding:isMobile?'18px 20px':'22px 26px',marginBottom:18,boxShadow:'0 12px 32px rgba(83,74,183,0.35)',position:'relative',overflow:'hidden'}}>
                <div style={{position:'absolute',top:-40,right:-40,width:160,height:160,borderRadius:'50%',background:'rgba(255,255,255,0.08)'}}/>
                <div style={{position:'absolute',bottom:-60,right:60,width:180,height:180,borderRadius:'50%',background:'rgba(255,255,255,0.05)'}}/>
                <div style={{position:'relative',display:'flex',justifyContent:'space-between',alignItems:'flex-end',flexWrap:'wrap' as const,gap:14}}>
                  <div>
                    <div style={{fontSize:isMobile?16:19,fontWeight:700,color:'#fff'}}>{greeting()}{userName&&userName!=='General'?`, ${greetingName(userName,userRole)}`:''}</div>
                    <div style={{fontSize:12,color:'rgba(255,255,255,0.65)',marginTop:3,display:'flex',alignItems:'center',gap:6}}>
                      <span style={{width:6,height:6,borderRadius:'50%',background:'#2DD4AA',display:'inline-block',boxShadow:'0 0 0 3px rgba(45,212,170,0.25)'}}/>
                      Attendance session live
                    </div>
                  </div>
                  <div style={{display:'flex',gap:isMobile?16:28}}>
                    <div>
                      <div style={{fontSize:isMobile?22:28,fontWeight:700,color:'#fff',lineHeight:1}}>{fmt(kpi?.today_present)}</div>
                      <div style={{fontSize:11,color:'rgba(255,255,255,0.6)',marginTop:3}}>check-ins today</div>
                    </div>
                    <div>
                      <div style={{fontSize:isMobile?22:28,fontWeight:700,color:'#fff',lineHeight:1}}>{kpi?.today_cells_reported??'—'}<span style={{fontSize:16,opacity:0.6}}>/{kpi?.today_cells_total??'—'}</span></div>
                      <div style={{fontSize:11,color:'rgba(255,255,255,0.6)',marginTop:3}}>cells reported</div>
                    </div>
                  </div>
                </div>
              </div>
              <div style={{display:'grid',gridTemplateColumns:isMobile?'repeat(2,1fr)':'repeat(4,1fr)',gap:10,marginBottom:18}}>
                {[
                  {label:'Total members',value:fmt(kpi?.total_members),delta:`+${kpi?.new_members_month??0} this month`,page:'members' as NavPage,icon:'ti-users',color:'#534AB7',bg:'rgba(83,74,183,0.12)',up:true},
                  {label:"Today's check-ins",value:fmt(kpi?.today_present),delta:`${kpi?.today_cells_reported??'—'}/${kpi?.today_cells_total??'—'} cells in`,page:'attendance' as NavPage,icon:'ti-calendar-stats',color:'#1D9E75',bg:'rgba(29,158,117,0.12)',up:true},
                  {label:'YTD giving',value:kpi?fmtNGN(kpi.ytd_giving_ngn):'—',delta:'Year to date',page:'giving' as NavPage,icon:'ti-coin',color:'#BA7517',bg:'rgba(186,117,23,0.12)',up:true},
                  {label:'Active cells',value:fmt(kpi?.active_cells),delta:`${new Set((dbCells||[]).map(c=>c.fel)).size} fellowships`,page:'cells' as NavPage,icon:'ti-circles',color:'#2563EB',bg:'rgba(37,99,235,0.12)',up:true},
                ].map(m=>(
                  <div key={m.label} onClick={()=>setPage(m.page)} style={{...card(),cursor:'pointer'}}
                    onMouseEnter={e=>{e.currentTarget.style.boxShadow='0 8px 24px rgba(83,74,183,0.18)'; e.currentTarget.style.transform='translateY(-2px)';}}
                    onMouseLeave={e=>{e.currentTarget.style.boxShadow='none'; e.currentTarget.style.transform='translateY(0)';}}>
                    <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:10}}>
                      <div style={{fontSize:isMobile?10:11,color:t.sub,fontWeight:500}}>{m.label}</div>
                      <div style={{width:30,height:30,borderRadius:9,background:m.bg,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,color:m.color}}><Icon name={m.icon} size={15}/></div>
                    </div>
                    <div style={{fontSize:isMobile?19:26,fontWeight:700,color:t.text,lineHeight:1.1}}>{m.value}</div>
                    <div style={{display:'inline-flex',alignItems:'center',gap:3,marginTop:8,fontSize:isMobile?10:11,fontWeight:600,color:'#1D9E75',background:'rgba(29,158,117,0.1)',borderRadius:20,padding:'3px 9px'}}>
                      <Icon name="ti-zap" size={10}/>{m.delta}
                    </div>
                  </div>
                ))}
              </div>
              <div style={{display:'grid',gridTemplateColumns:isMobile?'1fr':'1fr 1fr',gap:14,marginBottom:14}}>
                <div style={card()}>
                  <div style={{display:'flex',justifyContent:'space-between',marginBottom:10}}>
                    <span style={{fontSize:13,fontWeight:500,color:t.text}}>Attendance trend</span>
                    <span style={{fontSize:12,color:t.purple,cursor:'pointer'}} onClick={()=>setPage('attendance')}>View all →</span>
                  </div>
                  <AttendanceHistoryPanel t={t} color="#534AB7"
                    fetchUrl={(g,o)=>`/api/analytics/attendance/history?granularity=${g}&offset=${o}${selectedBranch?`&branch_id=${selectedBranch}`:''}`}
                    emptyText="No attendance logged for this window yet." />
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
                  {deptsList.length===0 ? (
                    <div style={{fontSize:12,color:t.muted}}>No departments yet.</div>
                  ) : [...deptsList].sort((a,b)=>b.count-a.count).slice(0,5).map(d=>(
                    <div key={d.id} style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8,fontSize:12}}>
                      <span style={{color:dark?'#E5E7EB':'#374151'}}>{d.name}</span>
                      <span style={{background:'#EEEDFE',color:'#3C3489',fontSize:11,padding:'2px 8px',borderRadius:10}}>{d.count} members</span>
                    </div>
                  ))}
                </div>
                <div onClick={()=>setPage('giving')} style={{...card(),cursor:'pointer'}}>
                  <div style={{display:'flex',justifyContent:'space-between',marginBottom:8}}><span style={{fontSize:13,fontWeight:500,color:t.text}}>Giving breakdown</span><span style={{fontSize:12,color:t.purple}}>Drill down →</span></div>
                  {(()=>{
                    const palette=['#534AB7','#1D9E75','#BA7517','#D85A30','#2563EB','#9333EA'];
                    const pieData=(kpi?.giving_breakdown||[]).map((g,i)=>({name:g.name,value:g.pct,color:palette[i%palette.length]}));
                    if(pieData.length===0) return <div style={{fontSize:12,color:t.muted,textAlign:'center',padding:'16px 0'}}>No giving recorded yet.</div>;
                    return (
                      <div style={{display:'flex',alignItems:'center',gap:10}}>
                        <ResponsiveContainer width={80} height={80}>
                          <PieChart><Pie data={pieData} cx={35} cy={35} innerRadius={20} outerRadius={35} dataKey="value" stroke="none">{pieData.map((e,i)=><Cell key={i} fill={e.color}/>)}</Pie></PieChart>
                        </ResponsiveContainer>
                        <div style={{flex:1}}>{pieData.map(g=>(
                          <div key={g.name} style={{display:'flex',alignItems:'center',gap:5,marginBottom:4,fontSize:11}}>
                            <div style={{width:8,height:8,borderRadius:2,background:g.color,flexShrink:0}}/>
                            <span style={{color:dark?'#E5E7EB':'#374151',flex:1}}>{g.name}</span>
                            <span style={{color:t.sub,fontWeight:500}}>{g.value}%</span>
                          </div>
                        ))}</div>
                      </div>
                    );
                  })()}
                </div>
                <div onClick={()=>setPage('cells')} style={{...card(),cursor:'pointer'}}>
                  <div style={{display:'flex',justifyContent:'space-between',marginBottom:10}}><span style={{fontSize:13,fontWeight:500,color:t.text}}>Cell alerts</span><span style={{fontSize:12,color:t.purple}}>View all →</span></div>
                  {(dbCells||[]).length===0 ? (
                    <div style={{fontSize:12,color:t.muted}}>No cells yet.</div>
                  ) : (dbCells||[]).filter(c=>c.status==='alert'||c.status==='watch').length===0 ? (
                    <div style={{fontSize:12,color:t.muted}}>No cells need attention right now.</div>
                  ) : (dbCells||[]).filter(c=>c.status==='alert'||c.status==='watch').slice(0,3).map(c=>(
                    <div key={c.cell} style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
                      <div><div style={{fontSize:12,color:dark?'#E5E7EB':'#374151',fontWeight:500}}>{c.cell}</div><div style={{fontSize:11,color:t.muted}}>{c.fel}</div></div>
                      <span style={{fontSize:11,padding:'2px 8px',borderRadius:10,fontWeight:500,background:ss(c.status).bg,color:ss(c.status).c}}>{c.trend}</span>
                    </div>
                  ))}
                  <div style={{fontSize:11,color:'#1D9E75',marginTop:4}}>✓ {(dbCells||[]).filter(c=>c.status==='rising').length} cells rising</div>
                </div>
              </div>
              {/* Membership Goals */}
              <div style={{marginTop:14,...card()}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
                  <div>
                    <div style={{fontSize:13,fontWeight:500,color:t.text}}>Membership Growth Goals</div>
                    <div style={{fontSize:11,color:t.muted,marginTop:2}}>Current: {fmt(kpi?.total_members)} members</div>
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
                    const current=kpi?.total_members||0;
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
            <PastorAttendance dark={dark} t={t} branchId={selectedBranch||undefined} isMobile={isMobile} />
          )}          {/* ══ GIVING ══ */}
          {page==='giving'&&(
            <PastorGiving dark={dark} t={t} branchId={selectedBranch||undefined} isMobile={isMobile} />
          )}
          {/* ══ MEMBERS ══ */}
          {page==='members'&&(
            <div style={{display:'flex',flexDirection:'column',gap:14}}>
              <div style={{display:'grid',gridTemplateColumns:isMobile?'repeat(2,1fr)':'repeat(4,1fr)',gap:10}}>
                {(()=>{
                  const children=kpi?.age_bands?.find(b=>b.band==='0–12')?.n||0;
                  const teens=kpi?.age_bands?.find(b=>b.band==='13–19')?.n||0;
                  return [
                    {label:'Total Members',value:fmt(kpi?.total_members),sub:'All statuses'},
                    {label:'Active Members',value:fmt(kpi?.active_members),sub:'Regularly attending'},
                    {label:'New This Month',value:fmt(kpi?.new_members_month),sub:new Date().toLocaleString('en-US',{month:'long',year:'numeric'})},
                    {label:'Children & Teens (0–19)',value:fmt(children+teens),sub:(kpi?.age_known||0)>0?`${children} children · ${teens} teens`:'No DOB data yet'},
                  ];
                })().map(s=>(
                  <div key={s.label} style={card()}>
                    <div style={{fontSize:11,color:t.sub,marginBottom:4}}>{s.label}</div>
                    <div style={{fontSize:22,fontWeight:500,color:t.text}}>{s.value}</div>
                    <div style={{fontSize:11,color:t.muted,marginTop:2}}>{s.sub}</div>
                  </div>
                ))}
              </div>
              <div style={{display:'grid',gridTemplateColumns:isMobile?'1fr':'1fr 1fr',gap:14}}>
                <div style={card()}>
                  <div style={{fontSize:13,fontWeight:500,marginBottom:12}}>Member Growth</div>
                  <TotalHistoryPanel t={t} color="#534AB7" valueLabel="Members"
                    fetchUrl={(g,o)=>`/api/analytics/members/history?granularity=${g}&offset=${o}${selectedBranch?`&branch_id=${selectedBranch}`:''}`}
                    emptyText="No members on file for this window yet." />
                </div>
                <div style={card()}>
                  <div style={{fontSize:13,fontWeight:500,marginBottom:12}}>Conversion Sources</div>
                  <div style={{fontSize:11,color:t.muted,textAlign:'center',padding:'20px 0'}}>Not wired yet — how a member first came to church is only captured on the first-timer&apos;s care card, and isn&apos;t yet linked through to their member record once converted.</div>
                  {false && [{src:'Cell outreach',n:312,p:27},{src:'Walk-in',n:298,p:26},{src:'Referral',n:241,p:21},{src:'Crusade',n:195,p:17},{src:'Online',n:101,p:9}].map(s=>(
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
                  {(kpi?.gender_known||0)===0 ? (
                    <div style={{fontSize:11,color:t.muted,textAlign:'center',padding:'20px 0'}}>No members have a gender on file yet — this fills in as profiles are completed.</div>
                  ) : (
                    <div style={{display:'flex',alignItems:'center',gap:16}}>
                      <ResponsiveContainer width={120} height={120}>
                        <PieChart><Pie data={(kpi?.gender_distribution||[]).map(g=>({name:g.name,value:g.pct}))} cx={55} cy={55} outerRadius={50} dataKey="value" stroke="none">{(kpi?.gender_distribution||[]).map((_,i)=><Cell key={i} fill={['#534AB7','#1D9E75','#BA7517'][i%3]}/>)}</Pie></PieChart>
                      </ResponsiveContainer>
                      <div>
                        {(kpi?.gender_distribution||[]).map((g,i)=>(
                          <div key={g.name} style={{display:'flex',alignItems:'center',gap:8,marginBottom:7,fontSize:12}}>
                            <div style={{width:10,height:10,borderRadius:2,background:['#534AB7','#1D9E75','#BA7517'][i%3],flexShrink:0}}/>
                            <span style={{color:dark?'#E5E7EB':'#374151',flex:1,textTransform:'capitalize'}}>{g.name}</span>
                            <span style={{fontWeight:500,color:dark?'#E5E7EB':'#374151'}}>{g.count} <span style={{color:t.muted,fontWeight:400}}>({g.pct}%)</span></span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                <div style={card()}>
                  <div style={{fontSize:13,fontWeight:500,marginBottom:12}}>Age Band Distribution</div>
                  {(kpi?.age_known||0)===0 ? (
                    <div style={{fontSize:11,color:t.muted,textAlign:'center',padding:'20px 0'}}>No members have a date of birth on file yet — this fills in as profiles are completed.</div>
                  ) : (kpi?.age_bands||[]).filter(a=>a.n>0).map(a=>(
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
                  <button onClick={()=>exportCSV(membersList.slice(0,10),'recent_additions_export')} style={{background:'#EEEDFE',color:'#3C3489',border:'none',borderRadius:8,padding:'4px 10px',fontSize:11,cursor:'pointer'}}>⬇ Export CSV</button>
                </div>
                <div style={{overflowX:'auto'}}>
                  <table style={{width:'100%',fontSize:12,borderCollapse:'collapse'}}>
                    <thead><tr style={{borderBottom:`0.5px solid ${t.navBorder}`}}>{['Name','Phone','Date Joined','Cell','Fellowship','Status'].map(h=><th key={h} style={{textAlign:'left',padding:'6px 8px',fontSize:10,fontWeight:500,color:t.sub,textTransform:'uppercase',letterSpacing:'0.05em',whiteSpace:'nowrap'}}>{h}</th>)}</tr></thead>
                    <tbody>
                      {membersList.length===0 ? (
                        <tr><td colSpan={6} style={{padding:'16px 8px',color:t.muted,textAlign:'center'}}>No members yet.</td></tr>
                      ) : membersList.slice(0,10).map(m=>(
                        <tr key={m.id} style={{borderBottom:`0.5px solid ${t.border}`}}>
                          <td style={{padding:'8px 8px',fontWeight:500,color:dark?'#E5E7EB':'#374151',whiteSpace:'nowrap'}}>{m.full_name}</td>
                          <td style={{padding:'8px 8px',color:t.sub,whiteSpace:'nowrap'}}>{m.phone||'—'}</td>
                          <td style={{padding:'8px 8px',color:t.sub,whiteSpace:'nowrap'}}>{m.join_date||'—'}</td>
                          <td style={{padding:'8px 8px',color:t.sub,whiteSpace:'nowrap'}}>{m.cell_name||'—'}</td>
                          <td style={{padding:'8px 8px',color:t.sub,whiteSpace:'nowrap'}}>{m.fellowship_name||'—'}</td>
                          <td style={{padding:'8px 8px'}}><span style={{fontSize:11,padding:'2px 8px',borderRadius:10,background:m.membership_status==='active'?'#E1F5EE':'#FAEEDA',color:m.membership_status==='active'?'#085041':'#633806',whiteSpace:'nowrap',textTransform:'capitalize'}}>{m.membership_status}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Full Member Database */}
              <div style={card()}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:membersExpanded?12:0,flexWrap:'wrap' as const,gap:8}}>
                  <button onClick={()=>setMembersExpanded(v=>!v)} style={{display:'flex',alignItems:'center',gap:8,background:'none',border:'none',cursor:'pointer',padding:0,fontFamily:'inherit'}}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{color:t.sub,transform:membersExpanded?'rotate(90deg)':'none',transition:'transform 0.2s ease',flexShrink:0}}><path d="M9 18l6-6-6-6"/></svg>
                    <span style={{fontSize:13,fontWeight:500,color:t.text}}>Full Member Database{kpi?` — ${fmt(kpi.total_members)} members`:''}</span>
                  </button>
                  {membersExpanded&&(
                    <div style={{display:'flex',gap:8}}>
                      <button onClick={()=>setShowCreateMember(true)} style={{background:t.purple,color:'#fff',border:'none',borderRadius:8,padding:'6px 12px',fontSize:11,fontWeight:600,cursor:'pointer'}}>+ Create Member</button>
                      <button onClick={()=>exportCSV(membersList.map(m=>({Name:m.full_name,Phone:m.phone,Cell:m.cell_name||'—',Fellowship:m.fellowship_name||'—',Joined:m.join_date||'—',Status:m.membership_status})),'full_member_database')} style={{background:'#EEEDFE',color:'#3C3489',border:'none',borderRadius:8,padding:'6px 10px',fontSize:11,cursor:'pointer'}}>⬇ Export</button>
                    </div>
                  )}
                </div>
                {membersExpanded&&<>
                <div style={{display:'flex',gap:8,marginBottom:12,flexWrap:'wrap'}}>
                  <input ref={memberSearchRef} value={memberSearch} onChange={e=>setMemberSearch(e.target.value)} placeholder="Search by name..." style={{border:`0.5px solid ${t.border}`,borderRadius:8,padding:'6px 10px',fontSize:12,outline:'none',flex:1,minWidth:160,background:t.input,color:t.text}}/>
                  {['overseer','general_overseer','branch_pastor','pa','lead_tech'].includes(userRole) && memberFellowshipsList.length>0 && (
                    <select value={memberFellowshipId} onChange={e=>setMemberFellowshipId(e.target.value)}
                      style={{border:`0.5px solid ${t.border}`,borderRadius:8,padding:'6px 10px',fontSize:12,outline:'none',background:t.input,color:t.text}}>
                      <option value="">All fellowships</option>
                      {memberFellowshipsList.map(f=>(<option key={f.id} value={f.id}>{f.name}</option>))}
                    </select>
                  )}
                  {['all','active','inactive'].map(f=>(
                    <button key={f} onClick={()=>setMemberFilter(f)}
                      style={{padding:'5px 10px',borderRadius:20,border:'0.5px solid',cursor:'pointer',fontSize:11,fontWeight:memberFilter===f?500:400,background:memberFilter===f?'#534AB7':t.cardInner,borderColor:memberFilter===f?'#534AB7':'#E5E7EB',color:memberFilter===f?'#fff':'#6B7280',textTransform:'capitalize' as const}}>
                      {f==='all'?'All':f}
                    </button>
                  ))}
                </div>
                {(()=>{
                  const canManage=['overseer', 'general_overseer', 'branch_pastor', 'pa', 'lead_tech'].includes(userRole);
                  const filtered=membersList.filter(m=>memberFilter==='all'?true:m.membership_status===memberFilter);
                  if(isMobile) return (
                    <div style={{maxHeight:480,overflowY:'auto',display:'flex',flexDirection:'column',gap:8}}>
                      {membersLoading?(
                        <div style={{padding:'20px 0',textAlign:'center',color:t.muted,fontSize:12}}>Loading members…</div>
                      ):filtered.length===0?(
                        <div style={{padding:'20px 0',textAlign:'center',color:t.muted,fontSize:12}}>No members found.</div>
                      ):filtered.map((m,i)=>(
                        <div key={m.id||i} style={{background:t.cardInner,borderRadius:10,border:`0.5px solid ${t.border}`,padding:'11px 13px'}}>
                          <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:8,marginBottom:6}}>
                            <div style={{fontWeight:600,fontSize:13,color:dark?'#E5E7EB':'#374151'}}>{m.full_name}</div>
                            <span style={{fontSize:10,padding:'2px 8px',borderRadius:10,flexShrink:0,background:m.membership_status==='active'?'#E1F5EE':'#FAECE7',color:m.membership_status==='active'?'#085041':'#993C1D',textTransform:'capitalize' as const}}>{m.membership_status}</span>
                          </div>
                          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:6,fontSize:11,color:t.sub,marginBottom:canManage?8:0}}>
                            <div><span style={{color:t.muted}}>Phone: </span>{m.phone||'—'}</div>
                            <div><span style={{color:t.muted}}>Cell: </span>{m.cell_name||'—'}</div>
                            <div><span style={{color:t.muted}}>Fellowship: </span>{m.fellowship_name||'—'}</div>
                            <div><span style={{color:t.muted}}>Joined: </span>{m.join_date?new Date(m.join_date).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'}):'—'}</div>
                          </div>
                          {canManage&&(
                            <div style={{display:'flex',gap:6}}>
                              <button onClick={()=>{setMoveTarget({id:m.id,name:m.full_name});setMoveCellId('');setMoveError('');}}
                                style={{flex:1,background:'transparent',color:t.purple,border:`0.5px solid ${t.border}`,borderRadius:6,padding:'6px 9px',fontSize:11,fontWeight:600,cursor:'pointer'}}>
                                Move
                              </button>
                              {userRole==='overseer'&&(
                                <button onClick={()=>{setDeleteTarget({id:m.id,name:m.full_name});setDeleteConfirmText('');}}
                                  style={{flex:1,background:'transparent',color:'#D85A30',border:'0.5px solid rgba(216,90,48,0.3)',borderRadius:6,padding:'6px 9px',fontSize:11,fontWeight:600,cursor:'pointer'}}>
                                  Delete
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                      {!membersLoading&&(
                        <div style={{fontSize:11,color:t.muted,padding:'8px 0',textAlign:'center'}}>
                          Showing {filtered.length} member{membersList.length===1?'':'s'}{memberSearch?` matching "${memberSearch}"`:' (capped at 200 — search to find others)'}
                        </div>
                      )}
                    </div>
                  );
                  return (
                  <div style={{overflowX:'auto',maxHeight:400,overflowY:'auto'}}>
                    <table style={{width:'100%',fontSize:12,borderCollapse:'collapse'}}>
                      <thead style={{position:'sticky',top:0,background:t.card}}>
                        <tr style={{borderBottom:`0.5px solid ${t.navBorder}`}}>
                          {[...['Name','Phone','Cell','Fellowship','Joined','Status'],...(canManage?['']:[])].map((h,hi)=>(
                            <th key={h||`action-${hi}`} style={{textAlign:'left',padding:'6px 8px',fontSize:10,fontWeight:500,color:t.sub,textTransform:'uppercase',letterSpacing:'0.05em',whiteSpace:'nowrap',background:t.card}}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {membersLoading?(
                          <tr><td colSpan={canManage?7:6} style={{padding:'20px 8px',textAlign:'center' as const,color:t.muted}}>Loading members…</td></tr>
                        ):filtered.length===0?(
                          <tr><td colSpan={canManage?7:6} style={{padding:'20px 8px',textAlign:'center' as const,color:t.muted}}>No members found.</td></tr>
                        ):filtered.map((m,i)=>(
                          <tr key={m.id||i} style={{borderBottom:`0.5px solid ${t.border}`}}>
                            <td style={{padding:'7px 8px',fontWeight:500,color:dark?'#E5E7EB':'#374151',whiteSpace:'nowrap'}}>{m.full_name}</td>
                            <td style={{padding:'7px 8px',color:t.sub,whiteSpace:'nowrap'}}>{m.phone||'—'}</td>
                            <td style={{padding:'7px 8px',color:t.sub,whiteSpace:'nowrap'}}>{m.cell_name||'—'}</td>
                            <td style={{padding:'7px 8px',color:t.sub,whiteSpace:'nowrap'}}>{m.fellowship_name||'—'}</td>
                            <td style={{padding:'7px 8px',color:t.sub,whiteSpace:'nowrap'}}>{m.join_date?new Date(m.join_date).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'}):'—'}</td>
                            <td style={{padding:'7px 8px'}}><span style={{fontSize:11,padding:'2px 8px',borderRadius:10,background:m.membership_status==='active'?'#E1F5EE':'#FAECE7',color:m.membership_status==='active'?'#085041':'#993C1D',textTransform:'capitalize' as const}}>{m.membership_status}</span></td>
                            {canManage&&(
                              <td style={{padding:'7px 8px',whiteSpace:'nowrap'}}>
                                <button onClick={()=>{setMoveTarget({id:m.id,name:m.full_name});setMoveCellId('');setMoveError('');}}
                                  style={{background:'transparent',color:t.purple,border:`0.5px solid ${t.border}`,borderRadius:6,padding:'4px 9px',fontSize:10,fontWeight:600,cursor:'pointer',marginRight:6}}>
                                  Move
                                </button>
                                {userRole==='overseer'&&(
                                  <button onClick={()=>{setDeleteTarget({id:m.id,name:m.full_name});setDeleteConfirmText('');}}
                                    style={{background:'transparent',color:'#D85A30',border:'0.5px solid rgba(216,90,48,0.3)',borderRadius:6,padding:'4px 9px',fontSize:10,fontWeight:600,cursor:'pointer'}}>
                                    Delete
                                  </button>
                                )}
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {!membersLoading&&(
                      <div style={{fontSize:11,color:t.muted,padding:'8px',textAlign:'center'}}>
                        Showing {filtered.length} member{membersList.length===1?'':'s'}{memberSearch?` matching "${memberSearch}"`:' (capped at 200 — search to find others)'}
                      </div>
                    )}
                  </div>
                  );
                })()}
                </>}
              </div>
            </div>
          )}
          {showCreateMember && <CreateMemberModal t={t} dark={dark} onClose={()=>setShowCreateMember(false)} onCreated={()=>{loadMembers();fetch('/api/analytics/dashboard',{credentials:'include'}).then(r=>r.json()).then(({data})=>{if(data)setKpi(data);}).catch(()=>{});}}/>}
          {showCreateCell && <CreateCellModal t={t} dark={dark} onClose={()=>setShowCreateCell(false)} onCreated={reloadCells}/>}
          {showMergeCells && <MergeCellsModal t={t} dark={dark} cells={dbCells||[]} onClose={()=>setShowMergeCells(false)} onMerged={reloadCells}/>}
          {showCreateDept && <CreateDepartmentModal t={t} dark={dark} onClose={()=>setShowCreateDept(false)} onCreated={reloadDeptsList}/>}
          {deleteTarget && (
            <div style={{position:'fixed',inset:0,background:'rgba(15,10,30,0.6)',backdropFilter:'blur(4px)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:200}}>
              <div style={{background:t.card,borderRadius:16,padding:24,maxWidth:420,width:'90%',border:'0.5px solid rgba(216,90,48,0.3)'}}>
                <div style={{fontSize:15,fontWeight:700,color:'#D85A30',marginBottom:8}}>Permanently delete {deleteTarget.name}?</div>
                <div style={{fontSize:12,color:t.sub,lineHeight:1.6,marginBottom:14}}>
                  This immediately and permanently deletes this member and every record tied to them —
                  department roles, cell links, submission history. <strong>There is no undo and no fallback.</strong> If
                  you only want to take them off the active roster (reversible), close this and use the removal
                  request flow instead.
                </div>
                <div style={{fontSize:11,color:t.muted,marginBottom:6}}>Type <strong>DELETE</strong> to confirm:</div>
                <input value={deleteConfirmText} onChange={e=>setDeleteConfirmText(e.target.value)} style={{width:'100%',border:`0.5px solid ${t.border}`,borderRadius:8,padding:'9px 11px',fontSize:13,background:t.input,color:t.text,outline:'none',fontFamily:'inherit',boxSizing:'border-box',marginBottom:16}}/>
                <div style={{display:'flex',gap:8}}>
                  <button onClick={()=>{setDeleteTarget(null);setDeleteConfirmText('');}} style={{flex:1,background:'transparent',border:`0.5px solid ${t.border}`,color:t.sub,borderRadius:8,padding:'9px',fontSize:12,fontWeight:600,cursor:'pointer'}}>Cancel</button>
                  <button onClick={confirmDeleteMember} disabled={deleteConfirmText!=='DELETE'||deleting}
                    style={{flex:1,background:'#D85A30',color:'#fff',border:'none',borderRadius:8,padding:'9px',fontSize:12,fontWeight:600,cursor:'pointer',opacity:(deleteConfirmText!=='DELETE'||deleting)?0.5:1}}>
                    {deleting?'Deleting…':'Delete permanently'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {moveTarget && (
            <div style={{position:'fixed',inset:0,background:'rgba(15,10,30,0.6)',backdropFilter:'blur(4px)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:200}}>
              <div style={{background:t.card,borderRadius:16,padding:24,maxWidth:420,width:'90%',border:`0.5px solid ${t.border}`}}>
                <div style={{fontSize:15,fontWeight:700,color:t.text,marginBottom:8}}>Move {moveTarget.name} to a different cell</div>
                <div style={{fontSize:12,color:t.sub,lineHeight:1.6,marginBottom:14}}>
                  Their fellowship updates automatically to match the new cell&apos;s fellowship — this can move
                  someone across fellowships, not just within one.
                </div>
                <select value={moveCellId} onChange={e=>setMoveCellId(e.target.value)}
                  style={{width:'100%',border:`0.5px solid ${t.border}`,borderRadius:8,padding:'9px 11px',fontSize:13,background:t.input,color:t.text,outline:'none',fontFamily:'inherit',boxSizing:'border-box',marginBottom:16}}>
                  <option value="">Select a cell...</option>
                  {(dbCells||[]).map(c=>(<option key={c.id} value={c.id}>{c.cell} — {c.fel}</option>))}
                </select>
                {moveError && <div style={{background:'#FAECE7',color:'#993C1D',borderRadius:8,padding:'8px 12px',fontSize:12,marginBottom:12}}>{moveError}</div>}
                <div style={{display:'flex',gap:8}}>
                  <button onClick={()=>{setMoveTarget(null);setMoveCellId('');}} style={{flex:1,background:'transparent',border:`0.5px solid ${t.border}`,color:t.sub,borderRadius:8,padding:'9px',fontSize:12,fontWeight:600,cursor:'pointer'}}>Cancel</button>
                  <button onClick={confirmMove} disabled={!moveCellId||moving}
                    style={{flex:1,background:t.purple,color:'#fff',border:'none',borderRadius:8,padding:'9px',fontSize:12,fontWeight:600,cursor:'pointer',opacity:(!moveCellId||moving)?0.5:1}}>
                    {moving?'Moving…':'Move member'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ══ DEPARTMENTS ══ */}
          {page==='departments'&&!selectedDeptId&&(
            <div style={card()}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:14}}>
                <div style={{fontSize:13,fontWeight:500}}>All Departments - click any to expand</div>
                <button onClick={()=>setShowCreateDept(true)} style={{background:t.purple,color:'#fff',border:'none',borderRadius:8,padding:'5px 12px',fontSize:11,fontWeight:600,cursor:'pointer'}}>+ Create Department</button>
              </div>
              {deptsLoading ? (
                <>{[0,1,2,3].map(i=><SkeletonRow key={i}/>)}</>
              ) : deptsList.length===0 ? (
                <div style={{fontSize:12,color:t.muted,padding:'12px 0'}}>No departments yet.</div>
              ) : isMobile ? (
              <div style={{display:'flex',flexDirection:'column',gap:8}}>
                {deptsList.map(d=>(
                  <div key={d.id} onClick={()=>setSelectedDeptId(d.id)} style={{background:t.cardInner,borderRadius:10,border:`0.5px solid ${t.border}`,padding:'11px 13px',cursor:'pointer'}}>
                    <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:8,marginBottom:6}}>
                      <div style={{fontWeight:600,fontSize:13,color:dark?'#E5E7EB':'#374151'}}>{d.name}</div>
                      <span style={{fontSize:10,padding:'2px 8px',borderRadius:10,flexShrink:0,background:d.status==='healthy'?'#E1F5EE':d.status==='alert'?'#FAECE7':d.status==='no_data'?'#F3F4F6':'#FAEEDA',color:d.status==='healthy'?'#085041':d.status==='alert'?'#993C1D':d.status==='no_data'?'#6B7280':'#633806',textTransform:'capitalize' as const}}>{d.status.replace('_',' ')}</span>
                    </div>
                    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',fontSize:11,color:t.sub}}>
                      <span>{d.leader} · {d.count} members</span>
                      {!d.submitted?<span style={{background:'#F3F4F6',color:'#6B7280',fontSize:10,padding:'2px 8px',borderRadius:10}}>No data yet</span>:d.absent>0?<span style={{background:'#FAECE7',color:'#993C1D',fontSize:10,padding:'2px 8px',borderRadius:10}}>{d.absent} absent</span>:<span style={{background:'#E1F5EE',color:'#085041',fontSize:10,padding:'2px 8px',borderRadius:10}}>Full attendance</span>}
                    </div>
                  </div>
                ))}
              </div>
              ) : (
              <div style={{overflowX:'auto'}}>
              <table style={{width:'100%',fontSize:12,borderCollapse:'collapse'}}>
                <thead><tr style={{borderBottom:`0.5px solid ${t.navBorder}`}}>{['Department','Leader','Members','Absences','Status'].map(h=><th key={h} style={{textAlign:'left',padding:'8px 10px',fontSize:11,fontWeight:500,color:t.sub,textTransform:'uppercase',letterSpacing:'0.05em'}}>{h}</th>)}</tr></thead>
                <tbody>
                  {deptsList.map(d=>(
                    <tr key={d.id} onClick={()=>setSelectedDeptId(d.id)} style={{borderBottom:`0.5px solid ${t.border}`,cursor:'pointer'}}
                      onMouseEnter={e=>e.currentTarget.style.background=t.hover}
                      onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                      <td style={{padding:'10px 10px',fontWeight:500,color:dark?'#E5E7EB':'#374151'}}>{d.name}</td>
                      <td style={{padding:'10px 10px',color:dark?'#E5E7EB':'#374151'}}>{d.leader}</td>
                      <td style={{padding:'10px 10px',color:dark?'#E5E7EB':'#374151'}}>{d.count}</td>
                      <td style={{padding:'10px 10px'}}>{!d.submitted?<span style={{background:'#F3F4F6',color:'#6B7280',fontSize:11,padding:'2px 8px',borderRadius:10}}>No data yet</span>:d.absent>0?<span style={{background:'#FAECE7',color:'#993C1D',fontSize:11,padding:'2px 8px',borderRadius:10}}>{d.absent} absent</span>:<span style={{background:'#E1F5EE',color:'#085041',fontSize:11,padding:'2px 8px',borderRadius:10}}>Full attendance</span>}</td>
                      <td style={{padding:'10px 10px'}}><span style={{background:d.status==='healthy'?'#E1F5EE':d.status==='alert'?'#FAECE7':d.status==='no_data'?'#F3F4F6':'#FAEEDA',color:d.status==='healthy'?'#085041':d.status==='alert'?'#993C1D':d.status==='no_data'?'#6B7280':'#633806',fontSize:11,padding:'2px 8px',borderRadius:10,textTransform:'capitalize'}}>{d.status.replace('_',' ')}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
              )}
            </div>
          )}
          {page==='departments'&&selectedDeptId&&(
            <div style={{display:'flex',flexDirection:'column',gap:14}}>
              <button onClick={()=>setSelectedDeptId(null)} style={{alignSelf:'flex-start',background:'#EEEDFE',color:'#3C3489',border:'none',borderRadius:8,padding:'6px 14px',fontSize:13,cursor:'pointer'}}>← Back to Departments</button>
              {deptDetailLoading || !deptDetail ? (
                <SkeletonCard>{Array.from({length:4},(_,i)=><SkeletonRow key={i}/>)}</SkeletonCard>
              ) : (
              <>
              <div style={card()}>
                <div style={{fontSize:15,fontWeight:600,color:t.text,marginBottom:2}}>{deptDetail.department.name}</div>
                <div style={{fontSize:12,color:t.sub,marginBottom:14}}>{deptDetail.members.length} total members{deptDetail.last_submission?` · Last submitted ${new Date(deptDetail.last_submission).toLocaleDateString()}`:' · No attendance submitted yet'}</div>
                <div style={{fontSize:12,fontWeight:500,color:dark?'#E5E7EB':'#374151',marginBottom:8}}>Full Member Roster — {deptDetail.members.length} members</div>
                {isMobile ? (
                  <div style={{display:'flex',flexDirection:'column',gap:8}}>
                    {deptDetail.members.length===0 ? (
                      <div style={{padding:'16px 0',color:t.muted,textAlign:'center',fontSize:12}}>No members on this department&apos;s roster yet.</div>
                    ) : deptDetail.members.map(m=>(
                      <div key={m.id} style={{background:t.cardInner,borderRadius:10,border:`0.5px solid ${t.border}`,padding:'11px 13px'}}>
                        <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:8,marginBottom:4}}>
                          <div style={{fontWeight:600,fontSize:13,color:dark?'#E5E7EB':'#374151'}}>{m.name}</div>
                          {m.status?<span style={{fontSize:10,padding:'2px 8px',borderRadius:10,flexShrink:0,background:m.status==='present'?'#E1F5EE':'#FAECE7',color:m.status==='present'?'#085041':'#993C1D',textTransform:'capitalize' as const}}>{m.status}</span>:<span style={{fontSize:10,color:t.muted,flexShrink:0}}>No data</span>}
                        </div>
                        <div style={{fontSize:11,color:t.sub,marginBottom:8}}>{m.role} · {m.phone||'—'}</div>
                        <button onClick={async()=>{
                          if(!confirm(`Remove ${m.name} from ${deptDetail.department.name}?`))return;
                          await fetch(`/api/admin/departments/members?department_id=${selectedDeptId}&member_id=${m.id}`,{method:'DELETE',credentials:'include'});
                          reloadDeptDetail();reloadDeptsList();
                        }} style={{width:'100%',background:'transparent',border:`0.5px solid rgba(216,90,48,0.3)`,borderRadius:6,color:t.coral,fontSize:11,fontWeight:600,padding:'6px 9px',cursor:'pointer'}}>Remove</button>
                      </div>
                    ))}
                  </div>
                ) : (
                <div style={{overflowX:'auto'}}>
                <table style={{width:'100%',fontSize:12,borderCollapse:'collapse'}}>
                  <thead><tr style={{borderBottom:`0.5px solid ${t.navBorder}`}}>{['Name','Role','Phone','Last Sunday',''].map(h=><th key={h} style={{textAlign:'left',padding:'6px 8px',fontSize:11,fontWeight:500,color:t.sub,textTransform:'uppercase',letterSpacing:'0.05em',whiteSpace:'nowrap'}}>{h}</th>)}</tr></thead>
                  <tbody>
                    {deptDetail.members.length===0 ? (
                      <tr><td colSpan={5} style={{padding:'16px 8px',color:t.muted,textAlign:'center'}}>No members on this department&apos;s roster yet.</td></tr>
                    ) : deptDetail.members.map(m=>(
                      <tr key={m.id} style={{borderBottom:`0.5px solid ${t.border}`}}>
                        <td style={{padding:'7px 8px',fontWeight:500,color:dark?'#E5E7EB':'#374151',whiteSpace:'nowrap'}}>{m.name}</td>
                        <td style={{padding:'7px 8px',color:t.sub,whiteSpace:'nowrap'}}>{m.role}</td>
                        <td style={{padding:'7px 8px',color:t.sub,whiteSpace:'nowrap'}}>{m.phone||'—'}</td>
                        <td style={{padding:'7px 8px'}}>{m.status?<span style={{fontSize:11,padding:'2px 8px',borderRadius:10,background:m.status==='present'?'#E1F5EE':'#FAECE7',color:m.status==='present'?'#085041':'#993C1D',textTransform:'capitalize'}}>{m.status}</span>:<span style={{fontSize:11,color:t.muted}}>No data</span>}</td>
                        <td style={{padding:'7px 8px'}}>
                          <button onClick={async()=>{
                            if(!confirm(`Remove ${m.name} from ${deptDetail.department.name}?`))return;
                            await fetch(`/api/admin/departments/members?department_id=${selectedDeptId}&member_id=${m.id}`,{method:'DELETE',credentials:'include'});
                            reloadDeptDetail();reloadDeptsList();
                          }} style={{background:'transparent',border:'none',color:t.coral,fontSize:11,cursor:'pointer'}}>Remove</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                </div>
                )}
              </div>

              <div style={card()}>
                <div style={{fontSize:13,fontWeight:600,color:t.text,marginBottom:10}}>Add a member to this department</div>
                <div style={{position:'relative'}}>
                  <input value={deptAddSearch} onChange={e=>{
                      setDeptAddSearch(e.target.value);
                      const q=e.target.value.trim();
                      if(q.length<2){setDeptAddResults([]);return;}
                      fetch(`/api/members/search?q=${encodeURIComponent(q)}`,{credentials:'include'}).then(r=>r.json()).then(({data})=>setDeptAddResults(data?.members||[])).catch(()=>{});
                    }} placeholder="Search member by name..."
                    style={{width:'100%',border:`0.5px solid ${t.border}`,borderRadius:8,padding:'9px 11px',fontSize:12,background:t.input,color:t.text,outline:'none',boxSizing:'border-box'}} />
                  {deptAddResults.length>0 && (
                    <div style={{position:'absolute',top:'100%',left:0,right:0,background:t.card,border:`0.5px solid ${t.border}`,borderRadius:8,marginTop:4,zIndex:10,maxHeight:180,overflowY:'auto'}}>
                      {deptAddResults.map((mm:{id:string;full_name:string})=>(
                        <div key={mm.id} onClick={async()=>{
                            await fetch('/api/admin/departments/members',{method:'POST',headers:{'Content-Type':'application/json'},credentials:'include',body:JSON.stringify({department_id:selectedDeptId,member_id:mm.id})});
                            setDeptAddSearch('');setDeptAddResults([]);reloadDeptDetail();reloadDeptsList();
                          }} style={{padding:'8px 11px',fontSize:12,cursor:'pointer',color:t.text}}>{mm.full_name}</div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div style={card()}>
                <div style={{fontSize:13,fontWeight:600,color:t.text,marginBottom:4}}>Invite a Head of Department</div>
                <div style={{fontSize:11,color:t.muted,marginBottom:10}}>Creates a one-time invite link for a new department_head account, scoped to {deptDetail.department.name}.</div>
                {deptInviteLink ? (
                  <div style={{display:'flex',flexDirection:'column',gap:6}}>
                    <div style={{fontSize:11,color:t.teal}}>Invite created — send this link:</div>
                    <div style={{display:'flex',gap:6}}>
                      <input readOnly value={deptInviteLink} style={{flex:1,border:`0.5px solid ${t.border}`,borderRadius:7,padding:'8px 10px',fontSize:11,background:t.input,color:t.text}} />
                      <button onClick={()=>navigator.clipboard.writeText(deptInviteLink)} style={{background:t.purple,color:'#fff',border:'none',borderRadius:7,padding:'8px 14px',fontSize:11,fontWeight:600,cursor:'pointer'}}>Copy</button>
                      <button onClick={()=>{setDeptInviteLink('');setDeptInviteName('');setDeptInviteEmail('');setDeptInvitePhone('');}} style={{background:'transparent',border:`0.5px solid ${t.border}`,borderRadius:7,padding:'8px 14px',fontSize:11,cursor:'pointer',color:t.muted}}>Done</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:8,marginBottom:8}}>
                      <input value={deptInviteName} onChange={e=>setDeptInviteName(e.target.value)} placeholder="Full name"
                        style={{border:`0.5px solid ${t.border}`,borderRadius:8,padding:'8px 10px',fontSize:12,background:t.input,color:t.text,outline:'none'}} />
                      <input value={deptInviteEmail} onChange={e=>setDeptInviteEmail(e.target.value)} placeholder="Email"
                        style={{border:`0.5px solid ${t.border}`,borderRadius:8,padding:'8px 10px',fontSize:12,background:t.input,color:t.text,outline:'none'}} />
                      <input value={deptInvitePhone} onChange={e=>setDeptInvitePhone(e.target.value)} placeholder="Phone (optional)"
                        style={{border:`0.5px solid ${t.border}`,borderRadius:8,padding:'8px 10px',fontSize:12,background:t.input,color:t.text,outline:'none'}} />
                    </div>
                    {deptInviteError && <div style={{fontSize:11,color:t.coral,marginBottom:8}}>{deptInviteError}</div>}
                    <button onClick={async()=>{
                        if(!deptInviteName.trim()||!deptInviteEmail.trim()){setDeptInviteError('Name and email are required');return;}
                        setDeptInviteSending(true);setDeptInviteError('');
                        try{
                          const res=await fetch('/api/invites',{method:'POST',headers:{'Content-Type':'application/json'},credentials:'include',body:JSON.stringify({email:deptInviteEmail.trim(),full_name:deptInviteName.trim(),role:'department_head',department_id:selectedDeptId})});
                          const json=await res.json();
                          if(res.ok){setDeptInviteLink(json.data.invite_link);reloadDeptsList();}
                          else setDeptInviteError(json.error?.message||'Failed to create invite');
                        }catch{setDeptInviteError('Network error.');}
                        setDeptInviteSending(false);
                      }} disabled={deptInviteSending} style={{background:t.teal,color:'#fff',border:'none',borderRadius:8,padding:'9px 16px',fontSize:12,fontWeight:600,cursor:'pointer',opacity:deptInviteSending?0.6:1}}>
                      {deptInviteSending?'Creating…':'Create invite'}
                    </button>
                  </>
                )}
              </div>
              </>
              )}
            </div>
          )}

          {/* ══ CELLS ══ */}
          {page==='cells'&&!selectedCell&&(
            <div style={{display:'flex',flexDirection:'column',gap:14}}>
              <div style={{display:'grid',gridTemplateColumns:isMobile?'repeat(2,1fr)':'repeat(4,1fr)',gap:10}}>
                {[{label:'Total Active Cells',value:String((dbCells||[]).length)},{label:'Rising',value:String((dbCells||[]).filter(c=>c.status==='rising').length)},{label:'Need Attention',value:String((dbCells||[]).filter(c=>c.status==='alert'||c.status==='watch').length)},{label:'Avg Attendance Rate',value:(()=>{const cells=(dbCells||[]);const withRate=cells.filter(c=>c.members>0);return withRate.length>0?`${Math.round(withRate.reduce((s,c)=>s+(c.avg/c.members*100),0)/withRate.length)}%`:'—';})()}].map(s=>(
                  <div key={s.label} style={card({padding:'10px 12px'})}><div style={{fontSize:11,color:t.sub,marginBottom:3}}>{s.label}</div><div style={{fontSize:20,fontWeight:500,color:t.text}}>{s.value}</div></div>
                ))}
              </div>
              <div style={card()}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10}}>
                  <div style={{fontSize:13,fontWeight:500,color:t.text}}>All {(dbCells||[]).length} Cells - click any cell to drill down</div>
                  <div style={{display:'flex',gap:8}}>
                    <button onClick={()=>setShowCreateCell(true)} style={{background:t.purple,color:'#fff',border:'none',borderRadius:8,padding:'5px 12px',fontSize:11,fontWeight:600,cursor:'pointer'}}>+ Create Cell</button>
                    <button onClick={()=>setShowMergeCells(true)} style={{background:'transparent',color:t.coral,border:`0.5px solid ${t.coral}`,borderRadius:8,padding:'5px 12px',fontSize:11,fontWeight:600,cursor:'pointer'}}>Merge Cells</button>
                    <button onClick={()=>exportCSV((dbCells||[]).map(c=>({Cell:c.cell,Fellowship:c.fel,Leader:c.leader,Members:c.members,AvgAttendance:c.avg,Rate:`${c.rate}%`,Trend:c.trend,Status:c.status})),'cells_export')}
                      style={{background:'#EEEDFE',color:'#3C3489',border:'none',borderRadius:8,padding:'5px 10px',fontSize:11,cursor:'pointer'}}>⬇ Export CSV</button>
                  </div>
                </div>
                <div style={{display:'flex',gap:6,marginBottom:12,flexWrap:'wrap'}}>
                  {[{key:'all',label:`All ${(dbCells||[]).length}`},{key:'rising',label:'Rising'},{key:'stable',label:'Stable'},{key:'watch',label:'Watch'},{key:'alert',label:'Intervention'},{key:'Youth',label:'Youth'},{key:'Women',label:'Women'},{key:'Men',label:'Men'}].map(f=>(
                    <button key={f.key} onClick={()=>setCellFilter(f.key)}
                      style={{padding:'4px 10px',borderRadius:20,border:'0.5px solid',cursor:'pointer',fontSize:11,fontWeight:cellFilter===f.key?500:400,
                        background:cellFilter===f.key?(f.key==='alert'?'#FAECE7':f.key==='watch'?'#FAEEDA':f.key==='rising'?'#E1F5EE':'#EEEDFE'):'transparent',
                        borderColor:cellFilter===f.key?(f.key==='alert'?'#D85A30':f.key==='watch'?'#BA7517':f.key==='rising'?'#1D9E75':'#534AB7'):'#E5E7EB',
                        color:cellFilter===f.key?(f.key==='alert'?'#993C1D':f.key==='watch'?'#633806':f.key==='rising'?'#085041':'#3C3489'):'#6B7280'}}>
                      {f.label}
                      {f.key!=='all'&&f.key!=='Youth'&&f.key!=='Women'&&f.key!=='Men'&&<span style={{marginLeft:4,fontWeight:400}}>({(dbCells||[]).filter(c=>c.status===f.key).length})</span>}
                    </button>
                  ))}
                </div>
                {isMobile ? (
                  <div style={{display:'flex',flexDirection:'column',gap:8}}>
                    {(dbCells||[]).filter(row=>cellFilter==='all'||(row.status===cellFilter)||(row.fel===cellFilter)).map((row,i)=>{const s=ss(row.status);return(
                      <div key={i} onClick={()=>setSelectedCell(row)} style={{background:t.cardInner,borderRadius:10,border:`0.5px solid ${t.border}`,padding:'11px 13px',cursor:'pointer'}}>
                        <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:8,marginBottom:6}}>
                          <div>
                            <div style={{fontWeight:600,fontSize:13,color:dark?'#E5E7EB':'#374151'}}>{row.cell}</div>
                            <div style={{fontSize:11,color:t.sub}}>{row.fel} · {row.leader}</div>
                          </div>
                          <span style={{fontSize:10,padding:'2px 8px',borderRadius:10,fontWeight:500,flexShrink:0,background:s.bg,color:s.c,whiteSpace:'nowrap'}}>{row.status==='alert'?'Intervention':row.status.charAt(0).toUpperCase()+row.status.slice(1)}</span>
                        </div>
                        <div style={{display:'flex',gap:12,alignItems:'center',fontSize:11,color:t.sub,marginBottom:6}}>
                          <span>{row.members} members</span>
                          <span style={{color:row.rate>=100?'#1D9E75':'#D85A30',fontWeight:500}}>{row.rate}% rate</span>
                          <span style={{fontWeight:500,color:row.trend.startsWith('+')?'#1D9E75':'#D85A30'}}>{row.trend}</span>
                        </div>
                        {!row.last_meeting_date?<span style={{fontSize:10,padding:'2px 8px',borderRadius:10,background:'#F3F4F6',color:'#6B7280'}}>No data yet</span>:row.meeting_this_week?<span style={{fontSize:10,padding:'2px 8px',borderRadius:10,background:'#E1F5EE',color:'#085041'}}>Logged this week</span>:<span style={{fontSize:10,padding:'2px 8px',borderRadius:10,background:'#FAECE7',color:'#993C1D'}}>Not this week</span>}
                      </div>
                    );})}
                  </div>
                ) : (
                <div className="table-wrap">
                  <table style={{width:'100%',fontSize:12,borderCollapse:'collapse',minWidth:600}}>
                    <thead><tr style={{borderBottom:`0.5px solid ${t.navBorder}`}}>{['Cell','Fellowship','Leader','Members','Avg Att.','Rate','Trend','Status','Weekly Meeting'].map(h=><th key={h} style={{textAlign:'left',padding:'6px 8px',fontSize:10,fontWeight:500,color:t.sub,textTransform:'uppercase',letterSpacing:'0.04em',whiteSpace:'nowrap'}}>{h}</th>)}</tr></thead>
                    <tbody>
                      {(dbCells||[]).filter(row=>cellFilter==='all'||(row.status===cellFilter)||(row.fel===cellFilter)).map((row,i)=>{const s=ss(row.status);return(
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
                          <td style={{padding:'8px 8px',whiteSpace:'nowrap'}}>{!row.last_meeting_date?<span style={{fontSize:11,padding:'2px 8px',borderRadius:10,background:'#F3F4F6',color:'#6B7280'}}>No data yet</span>:row.meeting_this_week?<span style={{fontSize:11,padding:'2px 8px',borderRadius:10,background:'#E1F5EE',color:'#085041'}}>Logged this week</span>:<span style={{fontSize:11,padding:'2px 8px',borderRadius:10,background:'#FAECE7',color:'#993C1D'}}>Not this week</span>}</td>
                        </tr>
                      );})}
                    </tbody>
                  </table>
                </div>
                )}
              </div>
            </div>
          )}
          {page==='cells'&&selectedCell&&(
            <div style={{display:'flex',flexDirection:'column',gap:14}}>
              <button onClick={()=>setSelectedCell(null)} style={{alignSelf:'flex-start',background:'#EEEDFE',color:'#3C3489',border:'none',borderRadius:8,padding:'6px 14px',fontSize:13,cursor:'pointer'}}>← Back to Cells</button>
              <div style={card()}>
                <input defaultValue={selectedCell.cell}
                  onBlur={async e=>{
                    const newName=e.target.value.trim();
                    if(!newName||newName===selectedCell.cell)return;
                    const cellId=(selectedCell as unknown as {id?:string}).id;
                    if(!cellId)return;
                    const res=await fetch('/api/fellowship/cells',{method:'PATCH',headers:{'Content-Type':'application/json'},credentials:'include',body:JSON.stringify({cell_id:cellId,name:newName})});
                    if(res.ok){reloadCells();setSelectedCell(sc=>sc?{...sc,cell:newName}:sc);}
                    else window.alert('Failed to rename cell.');
                  }}
                  style={{fontSize:15,fontWeight:600,color:t.text,border:`0.5px solid ${t.border}`,borderRadius:8,padding:'4px 8px',background:t.input,outline:'none',fontFamily:'inherit',marginBottom:6,width:'100%',boxSizing:'border-box'}} />
                <div style={{fontSize:12,color:t.sub,marginBottom:14}}>Leader: {selectedCell.leader} · {selectedCell.fel} Fellowship · {selectedCell.members} members · Avg: {selectedCell.avg} · Rate: {selectedCell.rate}%</div>
                <AttendanceHistoryPanel t={t} color={selectedCell.status==='alert'?'#D85A30':selectedCell.status==='rising'?'#1D9E75':'#534AB7'}
                  fetchUrl={(g,o)=>`/api/cells/history?cell_id=${(selectedCell as unknown as {id?:string})?.id}&granularity=${g}&offset=${o}`} />
              </div>
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
                  {[...['Monthly attendance report for June 2026'],...(userRole==='pa'?[]:['YTD giving analysis and projections']),...['Cell performance review with intervention recommendations','Membership growth analysis and conversion trends','Plan a realistic membership budget for all 35 cells based on current trends','Which 3 cells need immediate pastoral intervention and why?']].map(q=>(
                    <button key={q} onClick={()=>{setChatOpen(true);setChatInput(q);}}
                      style={{background:'#EEEDFE',color:'#3C3489',border:'none',borderRadius:8,padding:'8px 14px',fontSize:12,cursor:'pointer',fontWeight:500,textAlign:'left'}}>
                      {q}
                    </button>
                  ))}
                </div>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:10}}>
                {[{label:'Export All Attendance',data:(dbCells||[]).map(c=>({Cell:c.cell,Fellowship:c.fel,Avg:c.avg,Rate:`${c.rate}%`,Trend:c.trend})),file:'full_attendance'},{label:'Export Member List',data:membersList.map(m=>({Name:m.full_name,Phone:m.phone,Cell:m.cell_name||'—',Fellowship:m.fellowship_name||'—',Joined:m.join_date||'—',Status:m.membership_status})),file:'member_list'}].map(e=>(
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
                {isMobile ? (
                  <div style={{display:'flex',flexDirection:'column',gap:8}}>
                    {(showAlertOnly
                      ? (dbCells||[]).filter(c=>c.status==='alert'||c.status==='watch')
                      : [...(dbCells||[])].sort((a,b)=>(b.overall_score??0)-(a.overall_score??0)).slice(0,15)
                    ).map((c,i)=>{
                      const overall=c.overall_score??0;
                      const slaScore=c.submission_sla_score;
                      const tier=overall>=95?'Crown of Excellence':overall>=90?'Elite Shepherd':overall>=75?'Faithful Steward':overall>=60?'Consistent Servant':overall>=45?'Needs Improvement':'Requires Pastoral Review';
                      const tierColor=overall>=90?{bg:'#EEEDFE',c:'#3C3489'}:overall>=75?{bg:'#E1F5EE',c:'#085041'}:overall>=60?{bg:'#F3F4F6',c:'#374151'}:{bg:'#FAEEDA',c:'#993C1D'};
                      return(
                        <div key={c.cell} style={{background:t.cardInner,borderRadius:10,border:`0.5px solid ${t.border}`,padding:'11px 13px'}}>
                          <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:8,marginBottom:6}}>
                            <div style={{display:'flex',gap:8,alignItems:'baseline'}}>
                              <span style={{fontWeight:700,fontSize:13,color:i===0?'#BA7517':i===1?t.muted:t.sub}}>#{i+1}</span>
                              <div>
                                <div style={{fontWeight:600,fontSize:13,color:t.text}}>{c.leader}</div>
                                <div style={{fontSize:11,color:t.sub}}>{c.cell} · {c.fel}</div>
                              </div>
                            </div>
                            <div style={{textAlign:'right',flexShrink:0}}>
                              <div style={{fontWeight:700,fontSize:14,color:overall>=75?t.teal:t.coral}}>{overall}%</div>
                              <div style={{display:'flex',gap:3,justifyContent:'flex-end'}}>
                                {slaScore!=null&&slaScore>=90&&<span title="Unbroken — 12 consecutive on-time" style={{color:t.purple}}><Icon name="ti-trophy" size={12}/></span>}
                                {c.rate>=85&&<span title="Fellowship Excellence" style={{color:t.amber}}><Icon name="ti-star" size={12}/></span>}
                                {c.trend.startsWith('+')&&parseInt(c.trend)>=10&&<span title="Soul Winner" style={{color:t.teal}}><Icon name="ti-sprout" size={12}/></span>}
                              </div>
                            </div>
                          </div>
                          <span style={{fontSize:10,padding:'2px 8px',borderRadius:10,background:tierColor.bg,color:tierColor.c,fontWeight:500}}>{tier}</span>
                        </div>
                      );
                    })}
                  </div>
                ) : (
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
                        ? (dbCells||[]).filter(c=>c.status==='alert'||c.status==='watch')
                        : [...(dbCells||[])].sort((a,b)=>(b.overall_score??0)-(a.overall_score??0)).slice(0,15)
                      ).map((c,i)=>{
                        const slaScore=c.submission_sla_score;
                        const overall=c.overall_score??0;
                        const tier=overall>=95?'Crown of Excellence':overall>=90?'Elite Shepherd':overall>=75?'Faithful Steward':overall>=60?'Consistent Servant':overall>=45?'Needs Improvement':'Requires Pastoral Review';
                        const tierColor=overall>=90?{bg:'#EEEDFE',c:'#3C3489'}:overall>=75?{bg:'#E1F5EE',c:'#085041'}:overall>=60?{bg:'#F3F4F6',c:'#374151'}:{bg:'#FAEEDA',c:'#993C1D'};
                        return(
                          <tr key={c.cell} style={{borderBottom:`0.5px solid ${t.border}`}}>
                            <td style={{padding:'10px 10px',fontWeight:700,color:i===0?'#BA7517':i===1?t.muted:t.sub}}>{i+1}</td>
                            <td style={{padding:'10px 10px',fontWeight:500,color:t.text,whiteSpace:'nowrap'}}>{c.leader}</td>
                            <td style={{padding:'10px 10px',color:t.sub,whiteSpace:'nowrap'}}>{c.cell}</td>
                            <td style={{padding:'10px 10px',color:t.sub}}>{c.fel}</td>
                            <td style={{padding:'10px 10px',fontWeight:600,color:slaScore==null?t.muted:slaScore>=75?t.teal:t.coral}}>{slaScore==null?'—':`${slaScore}%`}</td>
                            <td style={{padding:'10px 10px',color:t.text}}>{c.rate}%</td>
                            <td style={{padding:'10px 10px',color:c.trend.startsWith('+')?t.teal:t.coral,fontWeight:500}}>{c.trend}</td>
                            <td style={{padding:'10px 10px',color:t.teal}}>{c.accuracy??100}%</td>
                            <td style={{padding:'10px 10px',fontWeight:700,color:overall>=75?t.teal:t.coral}}>{overall}%</td>
                            <td style={{padding:'10px 10px'}}><span style={{fontSize:10,padding:'2px 8px',borderRadius:10,background:tierColor.bg,color:tierColor.c,fontWeight:500,whiteSpace:'nowrap'}}>{tier}</span></td>
                            <td style={{padding:'10px 10px'}}>
                              <div style={{display:'flex',gap:4}}>
                                {slaScore!=null&&slaScore>=90&&<span title="Unbroken — 12 consecutive on-time" style={{color:t.purple}}><Icon name="ti-trophy" size={14}/></span>}
                                {c.rate>=85&&<span title="Fellowship Excellence" style={{color:t.amber}}><Icon name="ti-star" size={14}/></span>}
                                {c.trend.startsWith('+')&&parseInt(c.trend)>=10&&<span title="Soul Winner" style={{color:t.teal}}><Icon name="ti-sprout" size={14}/></span>}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                )}
              </div>

              {/* Top Fellowship Heads */}
              <div style={card()}>
                <div style={{fontSize:13,fontWeight:600,color:t.text,marginBottom:14}}>Fellowship Heads</div>
                <div style={{display:'grid',gridTemplateColumns:isMobile?'1fr':'repeat(3,1fr)',gap:12}}>
                  {Object.entries((dbCells||[]).reduce((acc:Record<string,NonNullable<typeof dbCells>>,c)=>{(acc[c.fel]=acc[c.fel]||[]).push(c);return acc;},{}))
                    .map(([name,group])=>{
                      const n=group.length||1;
                      const score=Math.round(group.reduce((s,c)=>s+(c.overall_score??0),0)/n);
                      const attendance=Math.round(group.reduce((s,c)=>s+c.rate,0)/n);
                      const growthPct=Math.round(group.reduce((s,c)=>s+(parseInt(c.trend)||0),0)/n);
                      const slaVals=group.map(c=>c.submission_sla_score).filter((v):v is number=>v!=null);
                      const slaAvg=slaVals.length>0?Math.round(slaVals.reduce((a,b)=>a+b,0)/slaVals.length):null;
                      const tier=score>=90?'Elite Shepherd':score>=75?'Faithful Steward':score>=60?'Consistent Servant':'Needs Improvement';
                      const tierColor=score>=90?{bg:'#EEEDFE',c:'#3C3489'}:score>=75?{bg:'#E1F5EE',c:'#085041'}:{bg:'#F3F4F6',c:'#374151'};
                      return(
                        <div key={name} style={{background:t.cardInner,borderRadius:10,padding:'14px 16px',border:`0.5px solid ${t.border}`}}>
                          <div style={{fontSize:12,fontWeight:600,color:t.text,marginBottom:8}}>{name}</div>
                          <div style={{fontSize:26,fontWeight:700,color:score>=80?t.teal:t.amber,marginBottom:4}}>{score}%</div>
                          <div style={{display:'flex',justifyContent:'space-between',fontSize:11,marginBottom:8}}>
                            <span style={{color:t.muted}}>Attendance: {attendance}%</span>
                            <span style={{color:growthPct>=0?t.teal:t.coral,fontWeight:500}}>{growthPct>=0?'+':''}{growthPct}%</span>
                          </div>
                          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                            <span style={{fontSize:10,padding:'2px 8px',borderRadius:10,background:tierColor.bg,color:tierColor.c,fontWeight:500}}>{tier}</span>
                            <span style={{fontSize:12,fontWeight:700,color:score>=80?t.teal:t.amber}}>SLA: {slaAvg==null?'—':`${slaAvg}%`}</span>
                          </div>
                        </div>
                      );
                  })}
                </div>
              </div>

              {/* Badge showcase */}
              <div style={card()}>
                <div style={{fontSize:13,fontWeight:600,color:t.text,marginBottom:14}}>Badge System</div>
                <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:10}}>
                  {[
                    {icon:'ti-clock',name:'On Time',desc:'4 consecutive on-time submissions',cat:'Promptness'},
                    {icon:'ti-clock',name:'Clockwork',desc:'8 consecutive on-time submissions',cat:'Promptness'},
                    {icon:'ti-zap',name:'Unbroken',desc:'12 consecutive on-time — full quarter',cat:'Promptness'},
                    {icon:'ti-trophy',name:'Legendary',desc:'52 consecutive on-time — full year',cat:'Promptness'},
                    {icon:'ti-eye',name:'Sharp Eye',desc:'Zero disputed submissions in a month',cat:'Accuracy'},
                    {icon:'ti-gem',name:'Crystal Clear',desc:'Zero disputes for a full quarter',cat:'Accuracy'},
                    {icon:'ti-shield',name:'Ironclad',desc:'Zero disputes pilot to year end',cat:'Accuracy'},
                    {icon:'ti-sprout',name:'First Harvest',desc:'First new convert in your cell',cat:'Growth'},
                    {icon:'ti-star',name:'Soul Winner',desc:'5 new converts retained',cat:'Growth'},
                    {icon:'ti-rocket',name:'Multiplier',desc:'Cell membership doubled',cat:'Growth'},
                    {icon:'ti-heart',name:'Restorer',desc:'5 members restored after absence',cat:'Care'},
                    {icon:'ti-crown',name:'Crown Carrier',desc:'Crown of Excellence for full quarter',cat:'Leadership'},
                  ].map(b=>(
                    <div key={b.name} className="shep-tab-enter" style={{background:t.cardInner,borderRadius:'var(--radius-sm)',padding:'10px 12px',border:`0.5px solid ${t.border}`,transition:'transform var(--motion-fast) var(--ease-out-expo)'}}>
                      <div style={{marginBottom:6,color:t.purple}}><Icon name={b.icon} size={20}/></div>
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
                    {type:'commendation' as const,icon:'ti-trophy',title:'Pastor Commends You',desc:'Celebrate a leader for outstanding performance'},
                    {type:'meeting' as const,icon:'ti-calendar-event',title:'Meeting Request',desc:'Request a one-on-one meeting with a leader'},
                    {type:'encouragement' as const,icon:'ti-heart',title:'Pastoral Encouragement',desc:'Send a warm message to a leader who needs support'},
                    {type:'announcement' as const,icon:'ti-speakerphone',title:'Announcement',desc:'Broadcast to all leaders of a fellowship or department'},
                  ].map(m=>(
                    <div key={m.type} onClick={()=>setCommendType(m.type)}
                      style={{background:commendType===m.type?t.purpleBg:t.cardInner,borderRadius:10,padding:'14px',border:`0.5px solid ${commendType===m.type?'#534AB7':t.border}`,cursor:'pointer'}}>
                      <div style={{marginBottom:8,color:t.purple}}><Icon name={m.icon} size={20}/></div>
                      <div style={{fontSize:12,fontWeight:600,color:t.text,marginBottom:4}}>{m.title}</div>
                      <div style={{fontSize:11,color:t.muted,lineHeight:1.4}}>{m.desc}</div>
                    </div>
                  ))}
                </div>

                <div style={{display:'flex',flexDirection:'column',gap:10}}>
                  <div>
                    <div style={{fontSize:10,color:t.muted,textTransform:'uppercase',letterSpacing:'0.5px',marginBottom:6}}>Send to</div>
                    <div style={{display:'flex',gap:6,marginBottom:8,flexWrap:'wrap' as const}}>
                      {[{v:'individual',label:'One leader'},{v:'fellowship',label:'A fellowship'},{v:'department',label:'A department'},{v:'all',label:'Everyone'}].map(s=>(
                        <button key={s.v} onClick={()=>setCommendScope(s.v as typeof commendScope)}
                          style={{padding:'5px 12px',borderRadius:20,border:`0.5px solid ${commendScope===s.v?'#534AB7':t.border}`,background:commendScope===s.v?'#534AB7':t.input,color:commendScope===s.v?'#fff':t.sub,fontSize:11,fontWeight:commendScope===s.v?600:400,cursor:'pointer'}}>
                          {s.label}
                        </button>
                      ))}
                    </div>
                    {commendScope==='individual' && (
                      <select value={commendLeader} onChange={e=>setCommendLeader(e.target.value)}
                        style={{width:'100%',border:`0.5px solid ${t.border}`,borderRadius:8,padding:'9px 11px',fontSize:12,background:t.input,color:t.text,outline:'none'}}>
                        <option value="">Select a leader...</option>
                        {leaderOptions.map(l=>(
                          <option key={l.id} value={l.id}>{l.full_name} — {l.role.replace('_',' ')}</option>
                        ))}
                      </select>
                    )}
                    {commendScope==='fellowship' && (
                      <select value={commendFellowshipId} onChange={e=>setCommendFellowshipId(e.target.value)}
                        style={{width:'100%',border:`0.5px solid ${t.border}`,borderRadius:8,padding:'9px 11px',fontSize:12,background:t.input,color:t.text,outline:'none'}}>
                        <option value="">Select a fellowship...</option>
                        {memberFellowshipsList.map(f=>(<option key={f.id} value={f.id}>{f.name}</option>))}
                      </select>
                    )}
                    {commendScope==='department' && (
                      <select value={commendDepartmentId} onChange={e=>setCommendDepartmentId(e.target.value)}
                        style={{width:'100%',border:`0.5px solid ${t.border}`,borderRadius:8,padding:'9px 11px',fontSize:12,background:t.input,color:t.text,outline:'none'}}>
                        <option value="">Select a department...</option>
                        {deptsList.map(d=>(<option key={d.id} value={d.id}>{d.name}</option>))}
                      </select>
                    )}
                    {commendScope==='all' && (
                      <div style={{fontSize:11,color:t.muted,padding:'8px 0'}}>Every cell leader, fellowship head, and department head in your branch.</div>
                    )}
                  </div>
                  <div>
                    <div style={{fontSize:10,color:t.muted,textTransform:'uppercase',letterSpacing:'0.5px',marginBottom:6}}>Message</div>
                    <textarea rows={4} value={commendMsg} onChange={e=>setCommendMsg(e.target.value)} placeholder="Write your message here... Recipients receive this as an in-app notification."
                      style={{width:'100%',border:`0.5px solid ${t.border}`,borderRadius:8,padding:'9px 11px',fontSize:12,background:t.input,color:t.text,outline:'none',resize:'none',fontFamily:'inherit'}}/>
                  </div>
                  {commendError && <div style={{background:'#FAECE7',color:'#993C1D',borderRadius:8,padding:'8px 12px',fontSize:12}}>{commendError}</div>}
                  {(()=>{
                    const canSend = commendScope==='individual'?!!commendLeader : commendScope==='fellowship'?!!commendFellowshipId : commendScope==='department'?!!commendDepartmentId : true;
                    return (
                      <button disabled={commendSending||!canSend||!commendMsg.trim()} onClick={async()=>{
                          setCommendSending(true); setCommendError('');
                          try{
                            const leader=leaderOptions.find(l=>l.id===commendLeader);
                            const fellowship=memberFellowshipsList.find(f=>f.id===commendFellowshipId);
                            const dept=deptsList.find(d=>d.id===commendDepartmentId);
                            const res=await fetch('/api/recognition/commend',{method:'POST',headers:{'Content-Type':'application/json'},credentials:'include',
                              body:JSON.stringify({leader_id:commendLeader,fellowship_id:commendFellowshipId,department_id:commendDepartmentId,scope:commendScope,commendation:commendMsg.trim(),category:commendType})});
                            const json=await res.json();
                            if(res.ok){
                              const to=commendScope==='individual'?(leader?.full_name||'Leader'):commendScope==='fellowship'?`${fellowship?.name||'Fellowship'} (${json.data?.recipient_count||0} recipients)`:commendScope==='department'?`${dept?.name||'Department'} (${json.data?.recipient_count||0} recipients)`:`Everyone (${json.data?.recipient_count||0} recipients)`;
                              setSentCommendations(prev=>[{to,type:commendType,msg:commendMsg.trim(),time:'Just now'},...prev]);
                              setCommendMsg(''); setCommendLeader(''); setCommendFellowshipId(''); setCommendDepartmentId('');
                            } else setCommendError(json.error?.message||'Failed to send.');
                          }catch{ setCommendError('Network error — message was not sent.'); }
                          setCommendSending(false);
                        }}
                        style={{background:'#534AB7',color:'#fff',border:'none',borderRadius:10,padding:'12px',fontSize:13,fontWeight:600,cursor:commendSending?'wait':'pointer',opacity:!canSend||!commendMsg.trim()?0.5:1}}>
                        {commendSending?'Sending…':'Send notification'}
                      </button>
                    );
                  })()}
                </div>
              </div>

              {/* Recent commendations */}
              <div style={card()}>
                <div style={{fontSize:13,fontWeight:600,color:t.text,marginBottom:12}}>Recent messages sent</div>
                {sentCommendations.length===0 ? (
                  <div style={{fontSize:12,color:t.muted,textAlign:'center',padding:'12px 0'}}>No messages sent yet this session.</div>
                ) : sentCommendations.map((r,i)=>(
                  <div key={i} style={{display:'flex',gap:10,padding:'10px 0',borderBottom:i<sentCommendations.length-1?`0.5px solid ${t.border}`:'none'}}>
                    <div style={{width:32,height:32,borderRadius:8,background:'#EEEDFE',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,color:'#534AB7'}}>
                      <Icon name={r.type==='commendation'?'ti-trophy':r.type==='encouragement'?'ti-heart':r.type==='meeting'?'ti-calendar-event':'ti-speakerphone'} size={16}/>
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
            <PastorRequisitions t={t} dark={dark} branchId={selectedBranch||undefined} />
          )}
          {page==='workforce'&&(
            <WorkforceIntelligencePanel t={t} branchId={selectedBranch||undefined} isMobile={isMobile} />
          )}
          {page==='action_board'&&(
            <ActionBoardPanel t={t} branchId={selectedBranch||undefined} />
          )}
          {page==='events'&&(
            <div style={{display:'flex',flexDirection:'column',gap:14}}>
              <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
                {[
                  {id:'planner' as const,label:'Order of Service',desc:'Who\'s anchoring what, and for how long — the run of a single service.'},
                  {id:'programs' as const,label:'Programs & Registration',desc:'Special events, crusades, conferences — plus their registration links.'},
                ].map(s=>(
                  <button key={s.id} onClick={()=>setEventsSubTab(s.id)}
                    onMouseEnter={e=>{ if(eventsSubTab!==s.id) e.currentTarget.style.transform='translateY(-1px)'; }}
                    onMouseLeave={e=>{ e.currentTarget.style.transform='translateY(0)'; }}
                    style={{padding:'8px 14px',borderRadius:'var(--radius-sm)',border:`0.5px solid ${eventsSubTab===s.id?'#534AB7':t.border}`,cursor:'pointer',background:eventsSubTab===s.id?'#534AB7':t.card,color:eventsSubTab===s.id?'#fff':t.text,fontSize:12,fontWeight:600,textAlign:'left' as const,boxShadow:eventsSubTab===s.id?'0 2px 10px rgba(83,74,183,0.3)':'none',transition:'all var(--motion-fast) var(--ease-out-expo)'}}>
                    {s.label}
                  </button>
                ))}
              </div>
              <div style={{fontSize:12,color:t.muted,marginTop:-6}}>
                {eventsSubTab==='planner'?'Order of Service — who\'s anchoring what, and for how long — the run of a single service.':'Programs & Registration — special events, crusades, conferences, and their registration links.'}
              </div>
              {eventsSubTab==='planner'?<ServicePlannerPanel t={t} branchId={selectedBranch||undefined} />:<EventsPanel t={t} />}
            </div>
          )}
          {page==='care_followup'&&(
            <CareFollowupPanel t={t} branchId={selectedBranch||undefined} />
          )}
          {page==='validation'&&(
            <div style={{display:'flex',flexDirection:'column',gap:14}}>
              <MemberApprovalPanel t={t} dark={dark} />
              <RemovalApprovalPanel t={t} dark={dark} userRole={userRole} />
              <FellowshipValidation t={t} dark={dark} isMobile={isMobile} />
            </div>
          )}
          {page==='settings'&&(
            <div>
              <ChurchSettingsPanel t={t} dark={dark} userRole={userRole} onConfigSaved={(cfg)=>setChurchConfig(cfg)} />
              {['overseer','general_overseer','lead_tech'].includes(userRole) && <TeamAccessPanel t={t} />}
            </div>
          )}
          {page==='admin'&&(
            <div style={{display:'flex',alignItems:'center',justifyContent:'center',paddingTop:60,flexDirection:'column',gap:16}}>
              <div style={{fontSize:14,color:t.sub}}>Opening Admin Portal…</div>
            </div>
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
            {[...['How are you?','Top 3 cells this month'],...(userRole==='pa'?[]:['Plan cell budgets','YTD giving summary']),...['Which cells need help?']].map(q=>(
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
