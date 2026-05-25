import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  Database,
  LogIn,
  Map as MapIcon,
  Plus,
  RefreshCw,
  RotateCcw,
  Save,
  SlidersHorizontal,
  Trash2,
  TrainFront,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import './styles.css';

const API_BASE = import.meta.env.VITE_API_BASE ?? 'http://127.0.0.1:39250/api';

const defaultStyle = {
  ridden: { color: '#0f766e', width: 8, dashArray: '' },
  unridden: { color: '#94a3b8', width: 4, dashArray: '8 8' },
  station: { color: '#111827', radius: 5 },
};

const sampleNetwork = {
  lines: [
    { id: 1, code: 'TEL', name_en: 'Thomson-East Coast Line', color: '#9d5b25', is_loop: false },
    { id: 2, code: 'DTL', name_en: 'Downtown Line', color: '#005ec4', is_loop: false },
  ],
  lineStations: [
    { id: 1, line_id: 1, station_code: 'TE14', display_name_en: 'Orchard', sequence_index: 1, diagram_x: 90, diagram_y: 96 },
    { id: 2, line_id: 1, station_code: 'TE15', display_name_en: 'Great World', sequence_index: 2, diagram_x: 230, diagram_y: 132 },
    { id: 3, line_id: 1, station_code: 'TE16', display_name_en: 'Havelock', sequence_index: 3, diagram_x: 360, diagram_y: 168 },
    { id: 4, line_id: 1, station_code: 'TE17', display_name_en: 'Outram Park', sequence_index: 4, diagram_x: 500, diagram_y: 204 },
    { id: 5, line_id: 2, station_code: 'DT19', display_name_en: 'Chinatown', sequence_index: 1, diagram_x: 450, diagram_y: 320 },
    { id: 6, line_id: 2, station_code: 'DT20', display_name_en: 'Fort Canning', sequence_index: 2, diagram_x: 560, diagram_y: 270 },
    { id: 7, line_id: 2, station_code: 'DT21', display_name_en: 'Bencoolen', sequence_index: 3, diagram_x: 670, diagram_y: 218 },
  ],
  segments: [
    { id: 1, line_id: 1, from_line_station_id: 1, to_line_station_id: 2, is_ridden: true },
    { id: 2, line_id: 1, from_line_station_id: 2, to_line_station_id: 3, is_ridden: true },
    { id: 3, line_id: 1, from_line_station_id: 3, to_line_station_id: 4, is_ridden: false },
    { id: 4, line_id: 2, from_line_station_id: 5, to_line_station_id: 6, is_ridden: false },
    { id: 5, line_id: 2, from_line_station_id: 6, to_line_station_id: 7, is_ridden: true },
  ],
};

const emptyLine = {
  code: '',
  name_en: '',
  name_zh: '',
  name_ms: '',
  name_ta: '',
  color: '#64748b',
  is_loop: false,
  display_order: 0,
};

const emptyPhysicalStation = {
  name_en: '',
  name_zh: '',
  name_ms: '',
  name_ta: '',
  lat: '',
  lng: '',
  notes: '',
};

const emptyLineStation = {
  line_id: '',
  physical_station_id: '',
  station_code: '',
  display_name_en: '',
  display_name_zh: '',
  display_name_ms: '',
  display_name_ta: '',
  branch_code: 'main',
  sequence_index: 1,
  diagram_x: '',
  diagram_y: '',
};

const emptySegment = {
  line_id: '',
  from_line_station_id: '',
  to_line_station_id: '',
  distance_km: '',
  direction_hint: '',
  is_counted: true,
  display_order: 1,
};

function apiFetch(path, token, options = {}) {
  return fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers ?? {}),
    },
  }).then(async (response) => {
    if (!response.ok) {
      const detail = await response.json().catch(() => ({}));
      throw new Error(typeof detail.detail === 'string' ? detail.detail : JSON.stringify(detail.detail ?? `HTTP ${response.status}`));
    }
    if (response.status === 204) return null;
    return response.json();
  });
}

function cleanPayload(payload) {
  return Object.fromEntries(
    Object.entries(payload).map(([key, value]) => [key, value === '' ? null : value]),
  );
}

function App() {
  const [token, setToken] = useState(localStorage.getItem('ashiato_token') ?? '');
  const [role, setRole] = useState(localStorage.getItem('ashiato_role') ?? '');
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('');
  const [view, setView] = useState('map');
  const [network, setNetwork] = useState(sampleNetwork);
  const [physicalStations, setPhysicalStations] = useState([]);
  const [style, setStyle] = useState(defaultStyle);
  const [message, setMessage] = useState('示例网络已载入。登录后会读取你的 MySQL 数据。');

  const stats = useMemo(() => {
    const total = network.segments.length;
    const ridden = network.segments.filter((segment) => segment.is_ridden).length;
    return { total, ridden, rate: total ? Math.round((ridden / total) * 100) : 0 };
  }, [network]);

  async function login(event) {
    event.preventDefault();
    try {
      const data = await apiFetch('/auth/login', '', {
        method: 'POST',
        body: JSON.stringify({ username, password }),
      });
      localStorage.setItem('ashiato_token', data.access_token);
      localStorage.setItem('ashiato_role', data.role);
      setToken(data.access_token);
      setRole(data.role);
      setMessage(`已登录：${data.role}`);
      await loadAll(data.access_token);
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function loadAll(activeToken = token) {
    if (!activeToken) {
      setMessage('请先登录。');
      return;
    }
    try {
      const [networkData, stationsData, pref] = await Promise.all([
        apiFetch('/network', activeToken),
        apiFetch('/physical-stations', activeToken),
        apiFetch('/preferences/network-style', activeToken),
      ]);
      setNetwork(networkData);
      setPhysicalStations(stationsData);
      if (pref.value_json) setStyle({ ...defaultStyle, ...pref.value_json });
      setMessage('已从后端刷新数据。');
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function saveStyle() {
    if (!token) {
      setMessage('请先登录。');
      return;
    }
    try {
      await apiFetch('/preferences/network-style', token, {
        method: 'PUT',
        body: JSON.stringify({ preference_key: 'network_style', value_json: style }),
      });
      setMessage('显示样式已保存。');
    } catch (error) {
      setMessage(error.message);
    }
  }

  useEffect(() => {
    if (token) loadAll(token);
  }, []);

  return (
    <main className="shell">
      <aside className="sidebar">
        <div className="brand">
          <TrainFront size={28} />
          <div>
            <h1>Ashiato MRT</h1>
            <p>Singapore segment tracker</p>
          </div>
        </div>

        <form className="panel" onSubmit={login}>
          <div className="panel-title">
            <LogIn size={18} />
            <span>登录</span>
          </div>
          <input value={username} onChange={(event) => setUsername(event.target.value)} placeholder="用户名" />
          <input value={password} onChange={(event) => setPassword(event.target.value)} placeholder="密码" type="password" />
          <button type="submit">登录</button>
        </form>

        <nav className="nav-panel">
          <button type="button" className={view === 'map' ? 'active' : ''} onClick={() => setView('map')}>
            <MapIcon size={16} />
            线路图
          </button>
          {role === 'admin' && (
            <button type="button" className={view === 'admin' ? 'active' : ''} onClick={() => setView('admin')}>
              <Database size={16} />
              数据维护
            </button>
          )}
        </nav>

        <section className="panel">
          <div className="panel-title">
            <SlidersHorizontal size={18} />
            <span>区段样式</span>
          </div>
          <StyleEditor label="已乘" value={style.ridden} onChange={(ridden) => setStyle({ ...style, ridden })} />
          <StyleEditor label="未乘" value={style.unridden} onChange={(unridden) => setStyle({ ...style, unridden })} />
          <div className="actions">
            <button type="button" onClick={() => loadAll()}>
              <RefreshCw size={16} />
              刷新
            </button>
            <button type="button" onClick={saveStyle}>
              <Save size={16} />
              保存
            </button>
          </div>
        </section>

        <section className="metrics">
          <div>
            <span>{stats.ridden}</span>
            <small>已乘区段</small>
          </div>
          <div>
            <span>{stats.total}</span>
            <small>总区段</small>
          </div>
          <div>
            <span>{stats.rate}%</span>
            <small>完成率</small>
          </div>
        </section>
      </aside>

      <section className="workspace">
        <div className="topbar">
          <div>
            <h2>{view === 'admin' ? '数据维护' : '线路图'}</h2>
            <p>{message}</p>
          </div>
          <div className="legend">
            {network.lines.map((line) => (
              <span key={line.id}>
                <i style={{ background: line.color }} />
                {line.code}
              </span>
            ))}
          </div>
        </div>
        {view === 'admin' && role === 'admin' ? (
          <AdminPanel
            token={token}
            network={network}
            physicalStations={physicalStations}
            onChange={() => loadAll()}
            onMessage={setMessage}
          />
        ) : (
          <NetworkDiagram network={network} styleConfig={style} />
        )}
      </section>
    </main>
  );
}

function StyleEditor({ label, value, onChange }) {
  return (
    <div className="style-editor">
      <label>
        <span>{label}颜色</span>
        <input type="color" value={value.color} onChange={(event) => onChange({ ...value, color: event.target.value })} />
      </label>
      <label>
        <span>粗细 {value.width}px</span>
        <input
          type="range"
          min="1"
          max="16"
          value={value.width}
          onChange={(event) => onChange({ ...value, width: Number(event.target.value) })}
        />
      </label>
      <label>
        <span>虚线</span>
        <select value={value.dashArray} onChange={(event) => onChange({ ...value, dashArray: event.target.value })}>
          <option value="">实线</option>
          <option value="8 8">短虚线</option>
          <option value="16 8">长虚线</option>
          <option value="2 8">点线</option>
        </select>
      </label>
    </div>
  );
}

function AdminPanel({ token, network, physicalStations, onChange, onMessage }) {
  const [tab, setTab] = useState('lines');
  const [lineForm, setLineForm] = useState(emptyLine);
  const [stationForm, setStationForm] = useState(emptyPhysicalStation);
  const [lineStationForm, setLineStationForm] = useState(emptyLineStation);
  const [segmentForm, setSegmentForm] = useState(emptySegment);
  const [editing, setEditing] = useState({ type: '', id: null });

  async function submit(path, payload, reset, label, editId = null) {
    try {
      await apiFetch(editId ? `${path}/${editId}` : path, token, {
        method: editId ? 'PUT' : 'POST',
        body: JSON.stringify(payload),
      });
      reset();
      await onChange();
      setEditing({ type: '', id: null });
      onMessage(`${label}已${editId ? '更新' : '创建'}。`);
    } catch (error) {
      onMessage(error.message);
    }
  }

  async function deleteSegment(row) {
    const label = `#${row.id} ${row.from_line_station_id} -> ${row.to_line_station_id}`;
    if (!window.confirm(`删除相邻区段 ${label}？`)) return;
    try {
      await apiFetch(`/segments/${row.id}`, token, { method: 'DELETE' });
      if (isEditing('segments') && editing.id === row.id) {
        setEditing({ type: '', id: null });
        setSegmentForm(emptySegment);
      }
      await onChange();
      onMessage(`相邻区段 ${label} 已删除。`);
    } catch (error) {
      onMessage(error.message);
    }
  }

  const lineStations = network.lineStations;
  const physicalStationById = useMemo(() => new Map(physicalStations.map((station) => [String(station.id), station])), [physicalStations]);
  const isEditing = (type) => editing.type === type && editing.id !== null;
  const startEdit = (type, row, setter) => {
    setEditing({ type, id: row.id });
    setter({ ...row });
    onMessage(`正在编辑 ${type} #${row.id}`);
  };
  const cancelEdit = (reset) => {
    setEditing({ type: '', id: null });
    reset();
    onMessage('已取消编辑。');
  };
  const updateLineStationPhysicalStation = (physical_station_id) => {
    const station = physicalStationById.get(String(physical_station_id));
    setLineStationForm({
      ...lineStationForm,
      physical_station_id,
      display_name_en: station?.name_en ?? '',
      display_name_zh: station?.name_zh ?? '',
      display_name_ms: station?.name_ms ?? '',
      display_name_ta: station?.name_ta ?? '',
      diagram_x: station?.lng ?? '',
      diagram_y: station?.lat ?? '',
    });
  };

  return (
    <div className="admin-board">
      <div className="admin-tabs">
        <button type="button" className={tab === 'lines' ? 'active' : ''} onClick={() => setTab('lines')}>线路</button>
        <button type="button" className={tab === 'stations' ? 'active' : ''} onClick={() => setTab('stations')}>实体车站</button>
        <button type="button" className={tab === 'lineStations' ? 'active' : ''} onClick={() => setTab('lineStations')}>线路站点</button>
        <button type="button" className={tab === 'segments' ? 'active' : ''} onClick={() => setTab('segments')}>相邻区段</button>
      </div>

      {tab === 'lines' && (
        <AdminSection title="线路" rows={network.lines} columns={['id', 'code', 'name_en', 'name_zh', 'color', 'is_loop', 'display_order']} onEdit={(row) => startEdit('lines', row, setLineForm)}>
          <form className="admin-form" onSubmit={(event) => {
            event.preventDefault();
            submit('/lines', { ...lineForm, display_order: Number(lineForm.display_order) || 0 }, () => setLineForm(emptyLine), '线路', isEditing('lines') ? editing.id : null);
          }}>
            <TextInput label="代码" value={lineForm.code} onChange={(code) => setLineForm({ ...lineForm, code })} required />
            <TextInput label="英文名" value={lineForm.name_en} onChange={(name_en) => setLineForm({ ...lineForm, name_en })} required />
            <TextInput label="中文名" value={lineForm.name_zh} onChange={(name_zh) => setLineForm({ ...lineForm, name_zh })} />
            <TextInput label="马来语名" value={lineForm.name_ms} onChange={(name_ms) => setLineForm({ ...lineForm, name_ms })} />
            <TextInput label="淡米尔语名" value={lineForm.name_ta} onChange={(name_ta) => setLineForm({ ...lineForm, name_ta })} />
            <TextInput label="颜色" type="color" value={lineForm.color} onChange={(color) => setLineForm({ ...lineForm, color })} />
            <TextInput label="排序" type="number" value={lineForm.display_order} onChange={(display_order) => setLineForm({ ...lineForm, display_order })} />
            <label className="check-row">
              <input type="checkbox" checked={lineForm.is_loop} onChange={(event) => setLineForm({ ...lineForm, is_loop: event.target.checked })} />
              环线
            </label>
            <button type="submit"><Plus size={16} />{isEditing('lines') ? '保存线路修改' : '新增线路'}</button>
            {isEditing('lines') && <button type="button" className="secondary" onClick={() => cancelEdit(() => setLineForm(emptyLine))}>取消编辑</button>}
          </form>
        </AdminSection>
      )}

      {tab === 'stations' && (
        <AdminSection title="实体车站" rows={physicalStations} columns={['id', 'name_en', 'name_zh', 'name_ms', 'name_ta', 'lat', 'lng']} onEdit={(row) => startEdit('stations', row, setStationForm)}>
          <form className="admin-form" onSubmit={(event) => {
            event.preventDefault();
            submit('/physical-stations', numericPayload(stationForm, ['lat', 'lng']), () => setStationForm(emptyPhysicalStation), '实体车站', isEditing('stations') ? editing.id : null);
          }}>
            <TextInput label="英文名" value={stationForm.name_en} onChange={(name_en) => setStationForm({ ...stationForm, name_en })} required />
            <TextInput label="中文名" value={stationForm.name_zh} onChange={(name_zh) => setStationForm({ ...stationForm, name_zh })} />
            <TextInput label="马来语名" value={stationForm.name_ms} onChange={(name_ms) => setStationForm({ ...stationForm, name_ms })} />
            <TextInput label="淡米尔语名" value={stationForm.name_ta} onChange={(name_ta) => setStationForm({ ...stationForm, name_ta })} />
            <TextInput label="纬度" type="number" step="0.000001" value={stationForm.lat} onChange={(lat) => setStationForm({ ...stationForm, lat })} />
            <TextInput label="经度" type="number" step="0.000001" value={stationForm.lng} onChange={(lng) => setStationForm({ ...stationForm, lng })} />
            <TextInput label="备注" value={stationForm.notes} onChange={(notes) => setStationForm({ ...stationForm, notes })} />
            <button type="submit"><Plus size={16} />{isEditing('stations') ? '保存车站修改' : '新增实体车站'}</button>
            {isEditing('stations') && <button type="button" className="secondary" onClick={() => cancelEdit(() => setStationForm(emptyPhysicalStation))}>取消编辑</button>}
          </form>
        </AdminSection>
      )}

      {tab === 'lineStations' && (
        <AdminSection title="线路站点" rows={lineStations} columns={['id', 'line_id', 'station_code', 'display_name_en', 'branch_code', 'sequence_index', 'diagram_x', 'diagram_y']} onEdit={(row) => startEdit('lineStations', row, setLineStationForm)}>
          <form className="admin-form" onSubmit={(event) => {
            event.preventDefault();
            submit(
              '/line-stations',
              numericPayload({ ...lineStationForm, branch_code: lineStationForm.branch_code || 'main' }, ['line_id', 'physical_station_id', 'sequence_index', 'diagram_x', 'diagram_y']),
              () => setLineStationForm(emptyLineStation),
              '线路站点',
              isEditing('lineStations') ? editing.id : null,
            );
          }}>
            <SelectInput label="线路" value={lineStationForm.line_id} onChange={(line_id) => setLineStationForm({ ...lineStationForm, line_id })} required>
              <option value="">选择线路</option>
              {network.lines.map((line) => <option key={line.id} value={line.id}>{line.code} - {line.name_en}</option>)}
            </SelectInput>
            <SelectInput label="实体车站" value={lineStationForm.physical_station_id} onChange={updateLineStationPhysicalStation} required>
              <option value="">选择实体车站</option>
              {physicalStations.map((station) => <option key={station.id} value={station.id}>{station.name_en}</option>)}
            </SelectInput>
            <TextInput label="站点编号" value={lineStationForm.station_code} onChange={(station_code) => setLineStationForm({ ...lineStationForm, station_code })} required />
            <TextInput label="英文显示名" value={lineStationForm.display_name_en} onChange={(display_name_en) => setLineStationForm({ ...lineStationForm, display_name_en })} required />
            <TextInput label="中文显示名" value={lineStationForm.display_name_zh} onChange={(display_name_zh) => setLineStationForm({ ...lineStationForm, display_name_zh })} />
            <TextInput label="马来语显示名" value={lineStationForm.display_name_ms} onChange={(display_name_ms) => setLineStationForm({ ...lineStationForm, display_name_ms })} />
            <TextInput label="淡米尔语显示名" value={lineStationForm.display_name_ta} onChange={(display_name_ta) => setLineStationForm({ ...lineStationForm, display_name_ta })} />
            <fieldset className="field radio-field">
              <legend>分支</legend>
              <label className="radio-option">
                <input type="radio" name="line-station-branch" value="main" checked={(lineStationForm.branch_code || 'main') === 'main'} onChange={(event) => setLineStationForm({ ...lineStationForm, branch_code: event.target.value })} />
                main
              </label>
            </fieldset>
            <TextInput label="顺序" type="number" value={lineStationForm.sequence_index} onChange={(sequence_index) => setLineStationForm({ ...lineStationForm, sequence_index })} />
            <TextInput label="图上 X" type="number" value={lineStationForm.diagram_x} onChange={(diagram_x) => setLineStationForm({ ...lineStationForm, diagram_x })} />
            <TextInput label="图上 Y" type="number" value={lineStationForm.diagram_y} onChange={(diagram_y) => setLineStationForm({ ...lineStationForm, diagram_y })} />
            <button type="submit"><Plus size={16} />{isEditing('lineStations') ? '保存线路站点修改' : '新增线路站点'}</button>
            {isEditing('lineStations') && <button type="button" className="secondary" onClick={() => cancelEdit(() => setLineStationForm(emptyLineStation))}>取消编辑</button>}
          </form>
        </AdminSection>
      )}

      {tab === 'segments' && (
        <AdminSection title="相邻区段" rows={network.segments} columns={['id', 'line_id', 'from_line_station_id', 'to_line_station_id', 'distance_km', 'is_counted', 'display_order']} onEdit={(row) => startEdit('segments', row, setSegmentForm)} onDelete={deleteSegment}>
          <form className="admin-form" onSubmit={(event) => {
            event.preventDefault();
            submit(
              '/segments',
              { ...numericPayload(segmentForm, ['line_id', 'from_line_station_id', 'to_line_station_id', 'distance_km', 'display_order']), geometry_json: null },
              () => setSegmentForm(emptySegment),
              '相邻区段',
              isEditing('segments') ? editing.id : null,
            );
          }}>
            <SelectInput label="线路" value={segmentForm.line_id} onChange={(line_id) => setSegmentForm({ ...segmentForm, line_id })} required>
              <option value="">选择线路</option>
              {network.lines.map((line) => <option key={line.id} value={line.id}>{line.code} - {line.name_en}</option>)}
            </SelectInput>
            <SelectInput label="起点线路站点" value={segmentForm.from_line_station_id} onChange={(from_line_station_id) => setSegmentForm({ ...segmentForm, from_line_station_id })} required>
              <option value="">选择起点</option>
              {lineStations.map((station) => <option key={station.id} value={station.id}>{station.station_code} - {station.display_name_en}</option>)}
            </SelectInput>
            <SelectInput label="终点线路站点" value={segmentForm.to_line_station_id} onChange={(to_line_station_id) => setSegmentForm({ ...segmentForm, to_line_station_id })} required>
              <option value="">选择终点</option>
              {lineStations.map((station) => <option key={station.id} value={station.id}>{station.station_code} - {station.display_name_en}</option>)}
            </SelectInput>
            <TextInput label="距离 km" type="number" step="0.001" value={segmentForm.distance_km} onChange={(distance_km) => setSegmentForm({ ...segmentForm, distance_km })} />
            <TextInput label="方向提示" value={segmentForm.direction_hint} onChange={(direction_hint) => setSegmentForm({ ...segmentForm, direction_hint })} />
            <TextInput label="排序" type="number" value={segmentForm.display_order} onChange={(display_order) => setSegmentForm({ ...segmentForm, display_order })} />
            <label className="check-row">
              <input type="checkbox" checked={segmentForm.is_counted} onChange={(event) => setSegmentForm({ ...segmentForm, is_counted: event.target.checked })} />
              计入完成率
            </label>
            <button type="submit"><Plus size={16} />{isEditing('segments') ? '保存区段修改' : '新增相邻区段'}</button>
            {isEditing('segments') && <button type="button" className="secondary" onClick={() => cancelEdit(() => setSegmentForm(emptySegment))}>取消编辑</button>}
          </form>
        </AdminSection>
      )}
    </div>
  );
}

function numericPayload(payload, numericKeys) {
  const cleaned = cleanPayload(payload);
  for (const key of numericKeys) {
    if (cleaned[key] !== null && cleaned[key] !== undefined) cleaned[key] = Number(cleaned[key]);
  }
  return cleaned;
}

function AdminSection({ title, rows, columns, children, onEdit, onDelete }) {
  return (
    <section className="admin-section">
      {children}
      <div className="data-list">
        <h3>{title}列表</h3>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>操作</th>
                {columns.map((column) => <th key={column}>{column}</th>)}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr><td colSpan={columns.length + 1}>暂无数据</td></tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <div className="table-actions">
                        <button type="button" className="table-action" onClick={() => onEdit(row)}>编辑</button>
                        {onDelete && (
                          <button type="button" className="table-action danger" onClick={() => onDelete(row)} title="删除相邻区段" aria-label="删除相邻区段">
                            <Trash2 size={14} />
                            删除
                          </button>
                        )}
                      </div>
                    </td>
                    {columns.map((column) => <td key={column}>{String(row[column] ?? '')}</td>)}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

function TextInput({ label, value, onChange, ...props }) {
  return (
    <label className="field">
      <span>{label}</span>
      <input value={value ?? ''} onChange={(event) => onChange(event.target.value)} {...props} />
    </label>
  );
}

function SelectInput({ label, value, onChange, children, ...props }) {
  return (
    <label className="field">
      <span>{label}</span>
      <select value={value ?? ''} onChange={(event) => onChange(event.target.value)} {...props}>
        {children}
      </select>
    </label>
  );
}

function NetworkDiagram({ network, styleConfig }) {
  const canvas = { width: 900, height: 620, padding: 78 };
  const [zoom, setZoom] = useState(1);
  const lineById = useMemo(() => new Map(network.lines.map((line) => [line.id, line])), [network.lines]);
  const plottedStations = useMemo(() => {
    const stationsWithCoordinates = network.lineStations
      .map((station) => ({
        ...station,
        rawX: Number(station.diagram_x ?? 80),
        rawY: Number(station.diagram_y ?? 80),
      }))
      .filter((station) => Number.isFinite(station.rawX) && Number.isFinite(station.rawY));
    if (stationsWithCoordinates.length === 0) return new Map();

    const xs = stationsWithCoordinates.map((station) => station.rawX);
    const ys = stationsWithCoordinates.map((station) => station.rawY);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const hasHorizontalRange = maxX > minX;
    const hasVerticalRange = maxY > minY;
    const rangeX = hasHorizontalRange ? maxX - minX : 1;
    const rangeY = hasVerticalRange ? maxY - minY : 1;
    const availableWidth = canvas.width - canvas.padding * 2;
    const availableHeight = canvas.height - canvas.padding * 2;
    const looksGeographic = xs.every((x) => x >= 95 && x <= 110) && ys.every((y) => y >= -2 && y <= 5);

    return new Map(stationsWithCoordinates.map((station) => {
      const x = hasHorizontalRange ? canvas.padding + ((station.rawX - minX) / rangeX) * availableWidth : canvas.width / 2;
      const yRatio = hasVerticalRange ? (station.rawY - minY) / rangeY : 0.5;
      const y = hasVerticalRange ? canvas.padding + (looksGeographic ? 1 - yRatio : yRatio) * availableHeight : canvas.height / 2;
      return [station.id, { ...station, x, y }];
    }));
  }, [network.lineStations]);
  const zoomPercent = Math.round(zoom * 100);
  const setBoundedZoom = (nextZoom) => setZoom(Math.min(4, Math.max(0.75, nextZoom)));

  const handleWheelZoom = (event) => {
    if (!event.ctrlKey && !event.metaKey) return;
    event.preventDefault();
    setBoundedZoom(zoom + (event.deltaY < 0 ? 0.25 : -0.25));
  };

  return (
    <section className="diagram-panel">
      <div className="diagram-toolbar" aria-label="线路图缩放控制">
        <div className="diagram-zoom-controls">
          <button type="button" className="icon-button" title="缩小线路图" aria-label="缩小线路图" onClick={() => setBoundedZoom(zoom - 0.25)}>
            <ZoomOut size={17} />
          </button>
          <input
            className="zoom-slider"
            type="range"
            min="0.75"
            max="4"
            step="0.25"
            value={zoom}
            aria-label="线路图缩放比例"
            onChange={(event) => setBoundedZoom(Number(event.target.value))}
          />
          <button type="button" className="icon-button" title="放大线路图" aria-label="放大线路图" onClick={() => setBoundedZoom(zoom + 0.25)}>
            <ZoomIn size={17} />
          </button>
          <button type="button" className="icon-button" title="重置缩放" aria-label="重置缩放" onClick={() => setZoom(1)}>
            <RotateCcw size={16} />
          </button>
        </div>
        <span className="diagram-zoom-value">{zoomPercent}%</span>
      </div>
      <div className="diagram-viewport" onWheel={handleWheelZoom}>
        <svg
          className="diagram"
          style={{ width: `${zoom * 100}%` }}
          viewBox={`0 0 ${canvas.width} ${canvas.height}`}
          role="img"
          aria-label="Singapore MRT riding segments"
        >
          <rect x="0" y="0" width={canvas.width} height={canvas.height} rx="0" fill="#f8fafc" />
          {network.segments.map((segment) => {
            const from = plottedStations.get(segment.from_line_station_id);
            const to = plottedStations.get(segment.to_line_station_id);
            const line = lineById.get(segment.line_id);
            if (!from || !to) return null;
            const segmentStyle = segment.is_ridden ? styleConfig.ridden : styleConfig.unridden;
            return (
              <line
                key={segment.id}
                x1={from.x}
                y1={from.y}
                x2={to.x}
                y2={to.y}
                stroke={segmentStyle.color || line?.color}
                strokeWidth={segmentStyle.width}
                strokeLinecap="round"
                strokeDasharray={segmentStyle.dashArray}
              />
            );
          })}
          {network.lineStations.map((station, index) => {
            const plottedStation = plottedStations.get(station.id);
            if (!plottedStation) return null;
            const labelOnLeft = plottedStation.x > canvas.width - 190;
            const labelX = plottedStation.x + (labelOnLeft ? -12 : 12);
            const labelY = plottedStation.y + (index % 2 === 0 ? -14 : 24);
            return (
              <g key={station.id}>
                <circle cx={plottedStation.x} cy={plottedStation.y} r={styleConfig.station.radius} fill="#fff" stroke={styleConfig.station.color} strokeWidth="2" />
                <text x={labelX} y={labelY} textAnchor={labelOnLeft ? 'end' : 'start'}>
                  {station.station_code}
                </text>
                <text className="station-name" x={labelX} y={labelY + 16} textAnchor={labelOnLeft ? 'end' : 'start'}>
                  {station.display_name_en}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </section>
  );
}

createRoot(document.getElementById('root')).render(<App />);
