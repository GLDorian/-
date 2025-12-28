import React, { useState, useEffect } from 'react';
import DocumentBuilder from './components/DocumentBuilder';
import ProjectDashboard from './components/ProjectDashboard';
import { LibraryData, ProjectNode, ProjectVersion, ProjectFile } from './types';
import { FileSpreadsheet } from 'lucide-react';

// ============================================================================
// 【模板库维护指南】
// 管理员请在此处编辑 INITIAL_LIBRARY 常量来维护内置的表单和变量。
// 
// 1. variables (变量库): 
//    定义所有可用的字段。
//    - id: 唯一标识符，建议大写，例如 'PK_DATE'
//    - label: 默认的字段文本/问题
//    - type: 数据类型 ('text', 'number', 'date', 'select', 'radio')
//    - options: (可选) 下拉或单选的选项列表，例如 ['是', '否']
//    - format: (可选) 数据格式说明，例如 'YYYY-MM-DD'
//
// 2. forms (表单库):
//    定义表单的结构。
//    - id: 表单唯一标识，例如 'F_PK'
//    - name: 表单显示名称
//    - type: 表单类型
//         - 'standard': 普通清单式表单 (如: 人口学, 不良事件)
//         - 'grid':     矩阵/网格表单 (如: PK采血, 多次体征测量)
//    - variableIds: (矩阵表单) 定义表格中的列变量；(普通表单) 定义所有变量
//    - headerVariableIds: (仅矩阵表单) 定义表格上方的公共变量 (如: 采血日期)
//    - defaultRows: (仅矩阵表单) 默认的行标题/时间点列表
// ============================================================================

const INITIAL_LIBRARY: LibraryData = {
  variables: [
    // 人口学 & 基础
    { id: 'DEM_01', label: '受试者姓名缩写', type: 'text', format: '最多4位字母' },
    { id: 'DEM_02', label: '出生日期', type: 'date', format: 'YYYY-MM-DD' },
    
    // 生命体征
    { id: 'VS_01', label: '收缩压 (mmHg)', type: 'number', format: '3位整数' },
    { id: 'VS_02', label: '舒张压 (mmHg)', type: 'number', format: '3位整数' },
    { id: 'VS_03', label: '心率 (bpm)', type: 'number', format: '3位整数' },
    
    // 不良事件
    { id: 'AE_01', label: '不良事件名称', type: 'text' },
    { id: 'AE_02', label: '严重程度', type: 'select', options: ['轻度', '中度', '重度'] },
    { id: 'AE_03', label: '与药物相关性', type: 'radio', options: ['肯定有关', '可能有关', '可能无关', '肯定无关'] },

    // PK 采血相关变量
    { id: 'PK_DONE', label: '是否采血', type: 'radio', options: ['是', '否'] },
    { id: 'PK_DATE', label: '采血日期', type: 'date', format: 'YYYY-MM-DD' },
    { id: 'PK_TIME', label: '采血时间', type: 'text', format: 'HH:MM (24h)' },
    { id: 'PK_REMARK', label: '备注', type: 'text' },
    
    // PK 尿液
    { id: 'URINE_VOL', label: '尿液体积 (mL)', type: 'number' },
    { id: 'URINE_START', label: '起始时间', type: 'text', format: 'HH:MM' },
    { id: 'URINE_END', label: '结束时间', type: 'text', format: 'HH:MM' }
  ],
  forms: [
    { 
      id: 'DM', 
      name: '人口学资料', 
      type: 'standard', 
      variableIds: ['DEM_01', 'DEM_02'] 
    },
    { 
      id: 'VS', 
      name: '生命体征', 
      type: 'standard', 
      variableIds: ['VS_01', 'VS_02', 'VS_03'] 
    },
    { 
      id: 'AE', 
      name: '不良事件', 
      type: 'standard', 
      variableIds: ['AE_01', 'AE_02', 'AE_03'] 
    },
    // 矩阵表单示例
    {
      id: 'PK',
      name: 'PK 采血记录',
      type: 'grid',
      // 定义表头变量 (整个表单共用的)
      headerVariableIds: ['PK_DATE'],
      // 定义表格列变量 (每一行都需要填写的)
      variableIds: ['PK_TIME', 'PK_DONE', 'PK_REMARK'],
      // 默认行/时间点
      defaultRows: ['给药前0h', '给药后0.5h', '给药后1h', '给药后2h', '给药后4h']
    }
  ]
};

const PROJECTS_STORAGE_KEY = 'docugen_pro_projects_v11'; // Bump version

const App: React.FC = () => {
  // State for managing multiple projects
  const [projects, setProjects] = useState<ProjectFile[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);

  // Load projects from local storage on mount
  useEffect(() => {
    const saved = localStorage.getItem(PROJECTS_STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
            setProjects(parsed);
        }
      } catch (e) {
        console.error("Failed to load projects", e);
      }
    }
  }, []);

  // Save projects to local storage whenever they change
  useEffect(() => {
    if (projects.length > 0) {
        localStorage.setItem(PROJECTS_STORAGE_KEY, JSON.stringify(projects));
    }
  }, [projects]);

  // --- Project Management Handlers ---

  const handleCreateProject = (name: string, description: string) => {
    const newProject: ProjectFile = {
        meta: {
            id: `PROJ_${Date.now()}`,
            name,
            description,
            createdAt: Date.now(),
            lastModified: Date.now()
        },
        data: {
            project: [],
            library: JSON.parse(JSON.stringify(INITIAL_LIBRARY)),
            versions: []
        }
    };
    setProjects(prev => [newProject, ...prev]);
    setActiveProjectId(newProject.meta.id);
  };

  const handleImportProject = (fileData: ProjectFile) => {
      // Check for duplicates
      if (projects.some(p => p.meta.id === fileData.meta.id)) {
          alert("项目 ID 已存在，请重试或重命名文件");
          return;
      }
      setProjects(prev => [fileData, ...prev]);
      setActiveProjectId(fileData.meta.id);
  };

  const handleDeleteProject = (id: string) => {
      setProjects(prev => prev.filter(p => p.meta.id !== id));
      if (activeProjectId === id) setActiveProjectId(null);
  };

  const handleOpenProject = (id: string) => {
      setActiveProjectId(id);
  };

  const handleBackToDashboard = () => {
      setActiveProjectId(null);
  };

  // --- Active Project Data Updaters ---
  // These function adapt the single-project setters to update the array of projects
  
  const activeProject = projects.find(p => p.meta.id === activeProjectId);

  const updateActiveProjectData = (updater: (data: ProjectFile['data']) => ProjectFile['data']) => {
      if (!activeProjectId) return;
      setProjects(prev => prev.map(p => {
          if (p.meta.id !== activeProjectId) return p;
          const newData = updater(p.data);
          return {
              ...p,
              meta: { ...p.meta, lastModified: Date.now() },
              data: newData
          };
      }));
  };

  // Wrappers to mimic setState for sub-components
  const setProjectWrapper = (valueOrFn: React.SetStateAction<ProjectNode[]>) => {
      updateActiveProjectData(data => {
          const newVal = typeof valueOrFn === 'function' ? (valueOrFn as any)(data.project) : valueOrFn;
          return { ...data, project: newVal };
      });
  };

  const setLibraryWrapper = (valueOrFn: React.SetStateAction<LibraryData>) => {
      updateActiveProjectData(data => {
          const newVal = typeof valueOrFn === 'function' ? (valueOrFn as any)(data.library) : valueOrFn;
          return { ...data, library: newVal };
      });
  };

  const setVersionsWrapper = (valueOrFn: React.SetStateAction<ProjectVersion[]>) => {
      updateActiveProjectData(data => {
          const newVal = typeof valueOrFn === 'function' ? (valueOrFn as any)(data.versions) : valueOrFn;
          return { ...data, versions: newVal };
      });
  };


  return (
    <div className="h-screen w-screen bg-slate-100 flex flex-col overflow-hidden font-sans">
      {!activeProjectId || !activeProject ? (
        <ProjectDashboard 
            projects={projects}
            onCreateProject={handleCreateProject}
            onImportProject={handleImportProject}
            onDeleteProject={handleDeleteProject}
            onOpenProject={handleOpenProject}
        />
      ) : (
        <div className="flex-1 p-4 h-full overflow-hidden">
             <DocumentBuilder
                // Pass Data
                library={activeProject.data.library}
                project={activeProject.data.project}
                versions={activeProject.data.versions}
                projectMeta={activeProject.meta} // Pass metadata for export
                
                // Pass Updaters
                setLibrary={setLibraryWrapper}
                setProject={setProjectWrapper}
                setVersions={setVersionsWrapper}
                
                // Navigation
                onBack={handleBackToDashboard}
            />
        </div>
      )}
    </div>
  );
};

export default App;