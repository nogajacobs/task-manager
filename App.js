import React, { useState, useEffect } from 'react';
import {
  StyleSheet, Text, View, TextInput, TouchableOpacity,
  FlatList, Modal, ScrollView, Alert,
  StatusBar, Platform, Animated, I18nManager,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';

// ─── Force RTL ───────────────────────────────────────────────────
I18nManager.forceRTL(true);

// ─── Palette ─────────────────────────────────────────────────────
const G = {
  bg:        '#FAFAF5',
  surface:   '#FFFFFF',
  surface2:  '#FDF8EC',
  border:    '#E8D89A',
  borderDim: '#F0E8C4',
  gold:      '#B8860B',
  goldLight: '#D4A017',
  goldShine: '#F0C040',
  ink:       '#2C1E00',
  inkMid:    '#6B4C0A',
  inkDim:    '#A07840',
  inkFaint:  '#C8A96A',
  red:       '#C0392B',
  green:     '#2E7D52',
  blue:      '#1A5E8A',
  orange:    '#C05A00',
};

const CATEGORIES  = ['עבודה','אישי','בריאות','קניות','לימודים','בית','אחר'];
const URGENCY     = [
  { label:'נמוכה',   color: G.green,  dot:'#4ADE80' },
  { label:'בינונית', color: G.blue,   dot:'#60A5FA' },
  { label:'גבוהה',   color: G.orange, dot:'#FB923C' },
  { label:'דחוף!',   color: G.red,    dot:'#EF4444' },
];
const STATUSES    = ['לא התחיל','בתהליך','הושלם'];
const STATUS_CFG  = {
  'לא התחיל': { color: G.inkDim, bg:'#F5F0E0' },
  'בתהליך':   { color: G.gold,   bg:'#FDF3CE' },
  'הושלם':    { color: G.green,  bg:'#E8F5EE' },
};
const FILTER_OPTS = ['הכל','לא התחיל','בתהליך','הושלם'];
const STORAGE_KEY = 'taskmanager-tasks-v2';

const DEMO = [
  { id:'1', title:'פגישה עם לקוח', category:'עבודה', urgency:2,
    description:'הכנת מצגת לסיכום הרבעון', date:new Date('2026-06-12').toISOString(),
    time:new Date('2026-06-12T10:00').toISOString(),
    status:'בתהליך', tags:['מצגת','רבעון'], duration:60, createdAt:Date.now() },
  { id:'2', title:'הזמן תור לרופא', category:'בריאות', urgency:1,
    description:'בדיקה שנתית', date:new Date('2026-06-15').toISOString(), time:null,
    status:'לא התחיל', tags:['בריאות'], duration:30, createdAt:Date.now() },
];

// ─── Helpers ─────────────────────────────────────────────────────
const fmtDate = d => {
  if (!d) return '';
  const dt = new Date(d);
  return `${String(dt.getDate()).padStart(2,'0')}/${String(dt.getMonth()+1).padStart(2,'0')}/${dt.getFullYear()}`;
};
const fmtTime = d => {
  if (!d) return '';
  const dt = new Date(d);
  return `${String(dt.getHours()).padStart(2,'0')}:${String(dt.getMinutes()).padStart(2,'0')}`;
};

// ─── Toast ───────────────────────────────────────────────────────
function Toast({ msg, anim }) {
  return (
    <Animated.View style={[s.toast,{
      opacity: anim,
      transform:[{ translateY: anim.interpolate({ inputRange:[0,1], outputRange:[16,0] }) }],
    }]}>
      <Text style={s.toastTxt}>{msg}</Text>
    </Animated.View>
  );
}

// ─── Task Card ────────────────────────────────────────────────────
function TaskCard({ task, onEdit, onDelete, onCycle }) {
  const urg  = URGENCY[task.urgency];
  const stat = STATUS_CFG[task.status];
  const done = task.status === 'הושלם';

  return (
    <View style={[s.card, done && { opacity:0.65 }]}>
      {/* colour strip */}
      <View style={[s.strip, { backgroundColor: done ? G.borderDim : urg.dot }]} />

      <View style={s.cardInner}>
        {/* row 1 — title + icons */}
        <View style={s.cardTop}>
          <View style={s.cardIcons}>
            <TouchableOpacity onPress={() => onEdit(task)} hitSlop={{top:8,bottom:8,left:8,right:8}}>
              <Ionicons name="pencil-outline" size={19} color={G.goldLight} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => onDelete(task.id)} hitSlop={{top:8,bottom:8,left:8,right:8}} style={{marginLeft:10}}>
              <Ionicons name="trash-outline" size={19} color={G.inkFaint} />
            </TouchableOpacity>
          </View>
          <Text style={[s.cardTitle, done && s.cardTitleDone]} numberOfLines={2}>
            {task.title}
          </Text>
        </View>

        {/* row 2 — badges */}
        <View style={s.badgeRow}>
          <TouchableOpacity
            style={[s.badge,{ backgroundColor:stat.bg, borderColor:stat.color+'40' }]}
            onPress={() => onCycle(task.id)}
            activeOpacity={0.7}
          >
            <Text style={[s.badgeTxt,{ color:stat.color }]}>{task.status}</Text>
          </TouchableOpacity>

          <View style={[s.badge,{ backgroundColor:'#FDF3CE', borderColor:urg.color+'40' }]}>
            <View style={[s.dot,{ backgroundColor:urg.dot }]} />
            <Text style={[s.badgeTxt,{ color:urg.color }]}>{urg.label}</Text>
          </View>

          <View style={[s.badge,{ backgroundColor:G.surface2, borderColor:G.border }]}>
            <Text style={[s.badgeTxt,{ color:G.inkMid }]}>{task.category}</Text>
          </View>
        </View>

        {/* description */}
        {!!task.description && (
          <Text style={s.cardDesc} numberOfLines={2}>{task.description}</Text>
        )}

        {/* meta */}
        {(task.date || task.duration > 0) && (
          <View style={s.metaRow}>
            {!!task.date && (
              <View style={s.metaItem}>
                <Ionicons name="calendar-outline" size={12} color={G.inkFaint} />
                <Text style={s.metaTxt}>
                  {fmtDate(task.date)}{task.time ? ` · ${fmtTime(task.time)}` : ''}
                </Text>
              </View>
            )}
            {task.duration > 0 && (
              <View style={s.metaItem}>
                <Ionicons name="time-outline" size={12} color={G.inkFaint} />
                <Text style={s.metaTxt}>{task.duration} דק'</Text>
              </View>
            )}
          </View>
        )}

        {/* tags */}
        {task.tags?.length > 0 && (
          <View style={s.tagRow}>
            {task.tags.map(t => (
              <View key={t} style={s.tag}>
                <Text style={s.tagTxt}>#{t}</Text>
              </View>
            ))}
          </View>
        )}
      </View>
    </View>
  );
}

// ─── Form Modal ───────────────────────────────────────────────────
function FormModal({ visible, task, onSave, onClose }) {
  const blank = { title:'', category:'עבודה', urgency:1, description:'',
                  date:null, time:null, status:'לא התחיל', tags:[], duration:30 };
  const [form,     setForm]     = useState(blank);
  const [tagInput, setTagInput] = useState('');
  const [showDate, setShowDate] = useState(false);
  const [showTime, setShowTime] = useState(false);

  useEffect(() => { setForm(task ? {...task} : blank); setTagInput(''); }, [visible]);

  const set = (k,v) => setForm(f=>({...f,[k]:v}));
  const addTag = () => {
    const t = tagInput.trim();
    if (t && !form.tags.includes(t)) set('tags',[...form.tags,t]);
    setTagInput('');
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={s.modalWrap}>

        {/* header */}
        <View style={s.modalHead}>
          <TouchableOpacity onPress={onClose}>
            <Ionicons name="close" size={24} color={G.inkMid} />
          </TouchableOpacity>
          <Text style={s.modalTitle}>{task?.id ? 'עריכת משימה' : 'משימה חדשה ✦'}</Text>
          <TouchableOpacity
            style={[s.saveBtn, !form.title.trim() && {opacity:0.4}]}
            onPress={() => {
              if (!form.title.trim()) { Alert.alert('שים לב','חובה כותרת'); return; }
              onSave(form);
            }}
          >
            <Text style={s.saveTxt}>שמור</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={s.modalBody} keyboardShouldPersistTaps="handled">

          {/* title */}
          <Text style={s.lbl}>כותרת *</Text>
          <TextInput style={s.inp} placeholder="מה צריך לעשות?"
            placeholderTextColor={G.inkFaint} value={form.title}
            onChangeText={v=>set('title',v)} textAlign="right" />

          {/* category */}
          <Text style={s.lbl}>קטגוריה</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{marginBottom:4}}>
            {CATEGORIES.map(c=>(
              <TouchableOpacity key={c}
                style={[s.chip, form.category===c && s.chipOn]}
                onPress={()=>set('category',c)}>
                <Text style={[s.chipTxt, form.category===c && s.chipTxtOn]}>{c}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* urgency */}
          <Text style={s.lbl}>דחיפות</Text>
          <View style={s.urgRow}>
            {URGENCY.map((u,i)=>(
              <TouchableOpacity key={i}
                style={[s.urgBtn, form.urgency===i && {backgroundColor:u.color+'18', borderColor:u.color}]}
                onPress={()=>set('urgency',i)}>
                <View style={[s.dot,{backgroundColor:u.dot}]} />
                <Text style={[s.urgTxt, {color: form.urgency===i ? u.color : G.inkFaint}]}>{u.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* description */}
          <Text style={s.lbl}>תיאור</Text>
          <TextInput style={[s.inp,{minHeight:76}]} placeholder="פרטים נוספים..."
            placeholderTextColor={G.inkFaint} value={form.description}
            onChangeText={v=>set('description',v)} multiline textAlign="right" textAlignVertical="top" />

          {/* date + time */}
          <View style={{flexDirection:'row', gap:10}}>
            <View style={{flex:1}}>
              <Text style={s.lbl}>תאריך</Text>
              <TouchableOpacity style={s.inp} onPress={()=>setShowDate(true)}>
                <Text style={{color: form.date ? G.ink : G.inkFaint, textAlign:'right'}}>
                  {form.date ? fmtDate(form.date) : 'בחרי תאריך'}
                </Text>
              </TouchableOpacity>
            </View>
            <View style={{flex:1}}>
              <Text style={s.lbl}>שעה</Text>
              <TouchableOpacity style={s.inp} onPress={()=>setShowTime(true)}>
                <Text style={{color: form.time ? G.ink : G.inkFaint, textAlign:'right'}}>
                  {form.time ? fmtTime(form.time) : 'בחרי שעה'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {showDate && (
            <DateTimePicker value={form.date ? new Date(form.date) : new Date()} mode="date"
              display={Platform.OS==='ios'?'spinner':'default'}
              onChange={(_,d)=>{ setShowDate(false); if(d) set('date',d.toISOString()); }} />
          )}
          {showTime && (
            <DateTimePicker value={form.time ? new Date(form.time) : new Date()} mode="time"
              display={Platform.OS==='ios'?'spinner':'default'}
              onChange={(_,d)=>{ setShowTime(false); if(d) set('time',d.toISOString()); }} />
          )}

          {/* status + duration */}
          <View style={{flexDirection:'row', gap:10}}>
            <View style={{flex:1}}>
              <Text style={s.lbl}>סטטוס</Text>
              {STATUSES.map(st=>(
                <TouchableOpacity key={st}
                  style={[s.statOpt, form.status===st && {backgroundColor:STATUS_CFG[st].bg, borderColor:STATUS_CFG[st].color+'50'}]}
                  onPress={()=>set('status',st)}>
                  <Text style={[s.statTxt, {color: form.status===st ? STATUS_CFG[st].color : G.inkFaint}]}>{st}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={{flex:1}}>
              <Text style={s.lbl}>משך (דק')</Text>
              <TextInput style={s.inp} keyboardType="numeric"
                value={String(form.duration)} textAlign="right"
                onChangeText={v=>set('duration',parseInt(v)||0)} />
            </View>
          </View>

          {/* tags */}
          <Text style={s.lbl}>תגיות</Text>
          <View style={{flexDirection:'row', gap:8, alignItems:'center', marginBottom:8}}>
            <TouchableOpacity style={s.tagAddBtn} onPress={addTag}>
              <Ionicons name="add" size={22} color={G.surface} />
            </TouchableOpacity>
            <TextInput style={[s.inp,{flex:1, marginBottom:0}]} placeholder="הוסיפי תגית ולחצי +"
              placeholderTextColor={G.inkFaint} value={tagInput}
              onChangeText={setTagInput} onSubmitEditing={addTag} textAlign="right" />
          </View>
          {form.tags.length > 0 && (
            <View style={s.tagRow}>
              {form.tags.map(t=>(
                <TouchableOpacity key={t} style={[s.tag,{borderColor:G.border}]}
                  onPress={()=>set('tags',form.tags.filter(x=>x!==t))}>
                  <Text style={s.tagTxt}>#{t} ×</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          <View style={{height:50}} />
        </ScrollView>
      </View>
    </Modal>
  );
}

// ─── Main ─────────────────────────────────────────────────────────
export default function App() {
  const [tasks,   setTasks]  = useState([]);
  const [loading, setLoad]   = useState(true);
  const [filter,  setFilter] = useState('הכל');
  const [sortBy,  setSort]   = useState('date');
  const [modal,   setModal]  = useState(false);
  const [editing, setEditing]= useState(null);
  const [toastMsg,setToastMsg]= useState('');
  const toastAnim = React.useRef(new Animated.Value(0)).current;

  useEffect(()=>{
    AsyncStorage.getItem(STORAGE_KEY)
      .then(v=>setTasks(v ? JSON.parse(v) : DEMO))
      .finally(()=>setLoad(false));
  },[]);

  const persist = async next => { setTasks(next); await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)); };

  const toast = msg => {
    setToastMsg(msg);
    Animated.sequence([
      Animated.timing(toastAnim,{toValue:1,duration:220,useNativeDriver:true}),
      Animated.delay(1800),
      Animated.timing(toastAnim,{toValue:0,duration:220,useNativeDriver:true}),
    ]).start();
  };

  const save = async form => {
    const next = form.id
      ? tasks.map(t=>t.id===form.id ? form : t)
      : [...tasks, {...form, id:Date.now().toString(), createdAt:Date.now()}];
    await persist(next);
    toast(form.id ? '✓ משימה עודכנה' : '✓ משימה נוספה');
    setModal(false); setEditing(null);
  };

  const del = id => Alert.alert('מחיקה','למחוק את המשימה?',[
    {text:'ביטול',style:'cancel'},
    {text:'מחק',style:'destructive', onPress:async()=>{ await persist(tasks.filter(t=>t.id!==id)); toast('🗑️ נמחקה'); }},
  ]);

  const cycle = async id => {
    const next = tasks.map(t=>{
      if(t.id!==id) return t;
      const ns = STATUSES[(STATUSES.indexOf(t.status)+1)%STATUSES.length];
      if(ns==='הושלם') toast('🎉 כל הכבוד!');
      return {...t, status:ns};
    });
    await persist(next);
  };

  const filtered = tasks
    .filter(t=>filter==='הכל'||t.status===filter)
    .sort((a,b)=>{
      if(sortBy==='date')    return (a.date||'')>(b.date||'')?1:-1;
      if(sortBy==='urgency') return b.urgency-a.urgency;
      return a.title.localeCompare(b.title,'he');
    });

  const total  = tasks.length;
  const done   = tasks.filter(t=>t.status==='הושלם').length;
  const urgent = tasks.filter(t=>t.urgency>=2&&t.status!=='הושלם').length;
  const pct    = total ? Math.round(done/total*100) : 0;

  if(loading) return (
    <View style={[s.root,{justifyContent:'center',alignItems:'center'}]}>
      <Text style={{fontSize:32, color:G.gold}}>✦</Text>
    </View>
  );

  return (
    <View style={s.root}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFDF0" />

      {/* ── HEADER ── */}
      <View style={s.header}>
        {/* top row */}
        <View style={s.hTop}>
          <View style={{flexDirection:'row', alignItems:'center', gap:8}}>
            <Text style={{fontSize:22, color:G.gold}}>✦</Text>
            <View>
              <Text style={s.hTitle}>המשימות שלי</Text>
              <Text style={s.hSub}>
                {done}/{total} הושלמו
                {urgent>0 && <Text style={{color:G.red}}>  ·  {urgent} דחופות</Text>}
              </Text>
            </View>
          </View>
          <TouchableOpacity style={s.fab} onPress={()=>{ setEditing(null); setModal(true); }}>
            <Ionicons name="add" size={26} color={G.surface} />
          </TouchableOpacity>
        </View>

        {/* progress */}
        {total>0 && (
          <View style={{marginBottom:12}}>
            <View style={s.progBg}>
              <View style={[s.progFill,{width:`${pct}%`}]} />
            </View>
            <Text style={s.progTxt}>{pct}% הושלם</Text>
          </View>
        )}

        {/* filter chips */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{marginBottom:8}}>
          {FILTER_OPTS.map(f=>(
            <TouchableOpacity key={f} style={[s.fChip, filter===f && s.fChipOn]} onPress={()=>setFilter(f)}>
              <Text style={[s.fChipTxt, filter===f && s.fChipTxtOn]}>{f}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* sort */}
        <View style={{flexDirection:'row', alignItems:'center', gap:6}}>
          <Text style={{fontSize:12, color:G.inkFaint}}>מיין:</Text>
          {[['date','תאריך'],['urgency','דחיפות'],['title','שם']].map(([k,l])=>(
            <TouchableOpacity key={k} style={[s.sortBtn, sortBy===k && s.sortBtnOn]} onPress={()=>setSort(k)}>
              <Text style={[s.sortTxt, sortBy===k && s.sortTxtOn]}>{l}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* ── LIST ── */}
      <FlatList
        data={filtered}
        keyExtractor={i=>i.id}
        contentContainerStyle={{padding:14, paddingBottom:50, flexGrow:1}}
        ListEmptyComponent={
          <View style={{alignItems:'center', paddingTop:80}}>
            <Text style={{fontSize:44, color:G.inkFaint, marginBottom:12}}>✦</Text>
            <Text style={{fontSize:16, color:G.inkDim, fontWeight:'600', marginBottom:16}}>
              {filter==='הכל' ? 'אין משימות עדיין' : `אין בסטטוס "${filter}"`}
            </Text>
            {filter==='הכל' && (
              <TouchableOpacity style={s.fab} onPress={()=>{ setEditing(null); setModal(true); }}>
                <Ionicons name="add" size={26} color={G.surface} />
              </TouchableOpacity>
            )}
          </View>
        }
        renderItem={({item})=>(
          <TaskCard task={item}
            onEdit={t=>{ setEditing(t); setModal(true); }}
            onDelete={del}
            onCycle={cycle}
          />
        )}
      />

      {/* ── MODAL ── */}
      <FormModal visible={modal} task={editing} onSave={save}
        onClose={()=>{ setModal(false); setEditing(null); }} />

      {/* ── TOAST ── */}
      <Toast msg={toastMsg} anim={toastAnim} />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────
const s = StyleSheet.create({
  root:   { flex:1, backgroundColor:G.bg },

  // header
  header: { backgroundColor:'#FFFDF0', paddingTop:Platform.OS==='ios'?54:36,
            paddingHorizontal:16, paddingBottom:12,
            borderBottomWidth:1, borderBottomColor:G.border,
            shadowColor:G.gold, shadowOpacity:0.12, shadowRadius:8, elevation:5 },
  hTop:   { flexDirection:'row', justifyContent:'space-between', alignItems:'center', marginBottom:12 },
  hTitle: { fontSize:22, fontWeight:'800', color:G.ink, textAlign:'right' },
  hSub:   { fontSize:13, color:G.inkDim, textAlign:'right', marginTop:1 },
  fab:    { backgroundColor:G.gold, width:46, height:46, borderRadius:15,
            justifyContent:'center', alignItems:'center',
            shadowColor:G.gold, shadowOpacity:0.45, shadowRadius:8, elevation:5 },

  // progress
  progBg:   { backgroundColor:G.borderDim, borderRadius:6, height:6, overflow:'hidden' },
  progFill: { backgroundColor:G.goldShine, height:'100%', borderRadius:6 },
  progTxt:  { fontSize:11, color:G.inkFaint, textAlign:'left', marginTop:3 },

  // filter
  fChip:      { backgroundColor:G.surface, borderWidth:1, borderColor:G.border,
                borderRadius:22, paddingHorizontal:16, paddingVertical:6, marginLeft:8 },
  fChipOn:    { backgroundColor:G.gold, borderColor:G.gold },
  fChipTxt:   { fontSize:13, color:G.inkMid },
  fChipTxtOn: { color:G.surface, fontWeight:'700' },

  // sort
  sortBtn:    { borderWidth:1, borderColor:G.borderDim, borderRadius:8,
                paddingHorizontal:10, paddingVertical:3 },
  sortBtnOn:  { backgroundColor:'#FDF3CE', borderColor:G.gold },
  sortTxt:    { fontSize:12, color:G.inkFaint },
  sortTxtOn:  { color:G.gold, fontWeight:'700' },

  // card
  card:       { backgroundColor:G.surface, borderRadius:16, marginBottom:12,
                borderWidth:1, borderColor:G.border, overflow:'hidden',
                shadowColor:G.gold, shadowOpacity:0.08, shadowRadius:6, elevation:3 },
  strip:      { height:4 },
  cardInner:  { padding:14 },
  cardTop:    { flexDirection:'row', justifyContent:'space-between', alignItems:'flex-start', marginBottom:10 },
  cardIcons:  { flexDirection:'row', alignItems:'center', marginLeft:4 },
  cardTitle:  { flex:1, fontSize:17, fontWeight:'700', color:G.ink, textAlign:'right', lineHeight:24 },
  cardTitleDone:{ textDecorationLine:'line-through', color:G.inkDim },
  badgeRow:   { flexDirection:'row', flexWrap:'wrap', gap:7, justifyContent:'flex-end', marginBottom:10 },
  badge:      { flexDirection:'row', alignItems:'center', gap:5,
                borderWidth:1, borderRadius:22, paddingHorizontal:11, paddingVertical:4 },
  badgeTxt:   { fontSize:12, fontWeight:'700' },
  dot:        { width:7, height:7, borderRadius:4 },
  cardDesc:   { fontSize:13, color:G.inkMid, textAlign:'right', lineHeight:20, marginBottom:8 },
  metaRow:    { flexDirection:'row', gap:16, justifyContent:'flex-end', flexWrap:'wrap', marginBottom:4 },
  metaItem:   { flexDirection:'row', alignItems:'center', gap:4 },
  metaTxt:    { fontSize:12, color:G.inkFaint },
  tagRow:     { flexDirection:'row', flexWrap:'wrap', gap:6, justifyContent:'flex-end', marginTop:6 },
  tag:        { backgroundColor:G.surface2, borderWidth:1, borderColor:G.borderDim,
                borderRadius:8, paddingHorizontal:9, paddingVertical:3 },
  tagTxt:     { fontSize:11, color:G.inkDim },

  // modal
  modalWrap:  { flex:1, backgroundColor:G.bg },
  modalHead:  { flexDirection:'row', alignItems:'center', justifyContent:'space-between',
                paddingHorizontal:16, paddingVertical:14,
                paddingTop:Platform.OS==='ios'?20:14,
                backgroundColor:'#FFFDF0',
                borderBottomWidth:1, borderBottomColor:G.border },
  modalTitle: { fontSize:17, fontWeight:'700', color:G.ink },
  saveBtn:    { backgroundColor:G.gold, borderRadius:11, paddingHorizontal:18, paddingVertical:8,
                shadowColor:G.gold, shadowOpacity:0.35, shadowRadius:6, elevation:3 },
  saveTxt:    { color:G.surface, fontWeight:'700', fontSize:14 },
  modalBody:  { padding:16 },

  // form
  lbl:        { fontSize:13, fontWeight:'700', color:G.inkMid, textAlign:'right', marginBottom:5, marginTop:14 },
  inp:        { backgroundColor:G.surface2, borderWidth:1, borderColor:G.border,
                borderRadius:12, padding:12, color:G.ink, fontSize:15, marginBottom:4 },
  chip:       { backgroundColor:G.surface, borderWidth:1, borderColor:G.border,
                borderRadius:22, paddingHorizontal:14, paddingVertical:6, marginLeft:8 },
  chipOn:     { backgroundColor:G.gold, borderColor:G.gold },
  chipTxt:    { fontSize:13, color:G.inkMid },
  chipTxtOn:  { color:G.surface, fontWeight:'700' },
  urgRow:     { flexDirection:'row', gap:8, marginBottom:4 },
  urgBtn:     { flex:1, flexDirection:'row', alignItems:'center', justifyContent:'center', gap:5,
                borderWidth:1, borderColor:G.border, borderRadius:11,
                paddingVertical:9, backgroundColor:G.surface },
  urgTxt:     { fontSize:12, fontWeight:'600' },
  statOpt:    { borderWidth:1, borderColor:G.borderDim, borderRadius:11,
                padding:10, marginBottom:7, backgroundColor:G.surface },
  statTxt:    { fontSize:14, textAlign:'right', fontWeight:'600' },
  tagAddBtn:  { backgroundColor:G.gold, borderRadius:11, padding:10,
                shadowColor:G.gold, shadowOpacity:0.3, shadowRadius:4, elevation:2 },

  // toast
  toast:      { position:'absolute', bottom:36, alignSelf:'center',
                backgroundColor:G.ink, paddingHorizontal:24, paddingVertical:12,
                borderRadius:26, borderWidth:1, borderColor:G.goldShine+'60',
                shadowColor:'#000', shadowOpacity:0.2, shadowRadius:8, elevation:8 },
  toastTxt:   { color:'#FDF3CE', fontSize:14, fontWeight:'700' },
});