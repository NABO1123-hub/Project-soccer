'use client'; // 클라이언트 사이드 인터랙션을 위해 필수

import { useState, useEffect, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';

// 환경 변수 타입 정의 (선택 사항이지만 오류 방지를 위해 권장)
declare global {
  namespace NodeJS {
    interface ProcessEnv {
      NEXT_PUBLIC_SUPABASE_URL?: string;
      NEXT_PUBLIC_SUPABASE_ANON_KEY?: string;
    }
  }
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://your-project.supabase.co';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'your-anon-key';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export default function Home() {
  const [votes, setVotes] = useState<any[]>([]);
  const [isAdminMode, setIsAdminMode] = useState(false);
  const [userName, setUserName] = useState('');
  const [alertMsg, setAlertMsg] = useState('');
  const [alertType, setAlertType] = useState<'error' | 'success'>('error');

  // DOM 요소 참조용 Ref
  const alertBoxRef = useRef<HTMLDivElement>(null);
  const userNameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadVotes();

    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && userNameInputRef.current === document.activeElement) {
        handleLogin();
      }
    };
    window.addEventListener('keypress', handleKeyPress);
    return () => window.removeEventListener('keypress', handleKeyPress);
  }, []);

  const showAlert = (msg: string, type: 'error' | 'success') => {
    setAlertMsg(msg);
    setAlertType(type);
    if (alertBoxRef.current) {
      alertBoxRef.current.style.display = 'block';
    }
    setTimeout(() => {
      if (alertBoxRef.current) alertBoxRef.current.style.display = 'none';
    }, 5000);
  };

  const loadVotes = async () => {
    try {
      const { data, error } = await supabase.from('votes').select('*').order('created_at', { ascending: false });
      if (!error) setVotes(data || []);
      else console.error(error);
    } catch (err) {
      showAlert("서버 연결 오류: " + err.message, 'error');
    }
  };

  const handleLogin = () => {
    const name = userName.trim();
    if (!name) {
      showAlert("이름을 입력해주세요.", 'error');
      return;
    }

    const isAdmin = name.toUpperCase() === 'ADMIN';
    // 관리자가 아닌 경우 중복 체크
    const isDuplicate = !isAdmin && votes.some(v => v.name === name);

    if (isAdmin) {
      setIsAdminMode(true);
      showAlert("관리자 모드로 진입했습니다.", 'success');
      loadVotes();
    } else if (isDuplicate) {
      showAlert("이미 투표하신 이름입니다. 중복 투표는 불가능합니다.", 'error');
      setUserName('');
      userNameInputRef.current?.focus();
    } else {
      setIsAdminMode(false);
      showAlert(`${name}님 환영합니다! 투표해주세요.`, 'success');
      // 점수 초기화 로직은 여기서 처리하거나 submit 시 처리해도 됨
    }
  };

  const goBackUp = () => {
    setIsAdminMode(false);
    setUserName('');
    setAlertMsg('');
    if (userNameInputRef.current) userNameInputRef.current.focus();
  };

  const handleResultChange = (result: string) => {
    const t1Input = document.getElementById('team1Score') as HTMLInputElement;
    const t2Input = document.getElementById('team2Score') as HTMLInputElement;

    if (result === 'home') {
      t1Input.value = '1';
      t2Input.value = '0';
    } else if (result === 'away') {
      t1Input.value = '0';
      t2Input.value = '1';
    } else {
      t1Input.value = '0';
      t2Input.value = '0';
    }
    validateScores(true);
  };

  const validateScores = (showSuccess = false: boolean) => {
    const result = (document.querySelector('input[name="result"]:checked') as HTMLInputElement)?.value || '';
    const t1 = parseInt((document.getElementById('team1Score') as HTMLInputElement).value) || 0;
    const t2 = parseInt((document.getElementById('team2Score') as HTMLInputElement).value) || 0;
    const isAlertBoxVisible = alertBoxRef.current?.style.display === 'block';

    let isValid = true;
    let message = "";

    if (result === 'home') {
      if (t1 <= t2) {
        isValid = false;
        message = "1 팀 승을 선택하셨습니다. 1 팀의 득점이 2 팀보다 높아야 합니다.";
      }
    } else if (result === 'away') {
      if (t2 <= t1) {
        isValid = false;
        message = "2 팀 승을 선택하셨습니다. 2 팀의 득점이 1 팀보다 높아야 합니다.";
      }
    } else if (result === 'draw') {
      if (t1 !== t2) {
        isValid = false;
        message = "무승부를 선택하셨습니다. 두 팀의 득점이 동일해야 합니다.";
      }
    }

    if (!isValid) {
      if (!isAlertBoxVisible) showAlert(message, 'error');
      return false;
    } else {
      if (isAlertBoxVisible) alertBoxRef.current?.style.display = 'none';
      return true;
    }
  };

  const submitVote = async () => {
    if (!validateScores()) return;

    const name = userName.trim();
    const result = (document.querySelector('input[name="result"]:checked') as HTMLInputElement).value;
    const t1 = parseInt((document.getElementById('team1Score') as HTMLInputElement).value) || 0;
    const t2 = parseInt((document.getElementById('team2Score') as HTMLInputElement).value) || 0;

    try {
      const { data, error } = await supabase.from('votes').insert({
        name: name,
        result: result,
        score1: t1,
        score2: t2
      });

      if (error) throw new Error(error.message);

      showAlert("투표가 완료되었습니다!", 'success');
      goBackUp();
      loadVotes();

    } catch (err) {
      showAlert("투표 실패: " + err.message, 'error');
    }
  };

  const renderAdminDashboard = () => {
    if (!isAdminMode) return;

    const total = votes.length;
    const homeWins = votes.filter(v => v.result === 'home').length;
    const draws = votes.filter(v => v.result === 'draw').length;
    const awayWins = votes.filter(v => v.result === 'away').length;

    const allScores = votes.map(v => v.score1 + v.score2);
    const avg = allScores.length > 0 
      ? (allScores.reduce((a, b) => a + b, 0) / allScores.length).toFixed(1) 
      : 0;

    // 상태 업데이트 (실제 UI 는 JSX 에서 렌더링되므로 여기서는 데이터 준비만 하거나, 
    // 간단히 JSX 내에서 직접 계산해도 됩니다. 여기서는 가독성을 위해 JSX 내에서 계산합니다.)
  };

  const resetData = async () => {
    if (!confirm("정말로 모든 투표 데이터를 삭제하시겠습니까?")) return;
    try {
      const { error } = await supabase.from('votes').delete();
      if (error) throw new Error(error.message);
      showAlert("데이터가 초기화되었습니다.", 'success');
      loadVotes();
    } catch (err) {
      showAlert("초기화 실패: " + err.message, 'error');
    }
  };

  const escapeHtml = (text: string) => {
    if (!text) return "";
    return text.replace(/[&<>"']/g, 
      tag => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
      }[tag] || tag));
  };

  return (
    <div className="card">
      <h2>⚽ 축구 결과 투표</h2>

      {/* 로그인 섹션 */}
      <div id="loginSection">
        <div className="input-group">
          <label htmlFor="userName">이름을 입력하세요</label>
          <input 
            ref={userNameInputRef}
            type="text" 
            id="userName" 
            value={userName} 
            onChange={(e) => setUserName(e.target.value)}
            placeholder="예: 홍길동 또는 ADMIN" 
          />
        </div>
        <button className="btn btn-enter" onClick={handleLogin}>입장하기</button>
      </div>

      {/* 알림 박스 */}
      <div 
        ref={alertBoxRef} 
        className={`alertBox alert-${alertType}`} 
        style={{ display: alertMsg ? 'block' : 'none' }}
      >
        {alertMsg}
      </div>

      {/* 투표 섹션 (관리자가 아닐 때) */}
      <div id="voteSection" className={`hidden ${!isAdminMode && userName ? '' : 'hidden'}`}>
        <button className="btn btn-back" id="backBtn" onClick={goBackUp}>← 이름 입력으로 돌아가기</button>

        <div className="form-group">
          <label>홈팀</label>
          <input type="text" value="1 팀 (대한민국)" readonly style={{background:'#f5f5f5', color:'#666', cursor:'not-allowed'}} />
        </div>
        <div className="form-group">
          <label>원정팀</label>
          <input type="text" value="2 팀 (체코)" readonly style={{background:'#f5f5f5', color:'#666', cursor:'not-allowed'}} />
        </div>

        <div className="form-group">
          <label>경기 결과</label>
          <div className="radio-group">
            <label className="radio-label"><input type="radio" name="result" value="home" checked onChange={() => handleResultChange('home')} /> 1 팀 승</label>
            <label className="radio-label"><input type="radio" name="result" value="draw" onChange={() => handleResultChange('draw')} /> 무승부</label>
            <label className="radio-label"><input type="radio" name="result" value="away" onChange={() => handleResultChange('away')} /> 2 팀 승</label>
          </div>
        </div>

        <div className="score-box">
          <div className="form-group">
            <label>1 팀 득점</label>
            <input type="number" id="team1Score" className="score-input" min="0" value="0" onInput={() => validateScores()} />
          </div>
          <div className="form-group">
            <label>2 팀 득점</label>
            <input type="number" id="team2Score" className="score-input" min="0" value="0" onInput={() => validateScores()} />
          </div>
        </div>

        <button className="btn btn-vote" id="submitBtn" onClick={submitVote}>투표 제출하기</button>

        <div id="resultArea" style={{ marginTop: '1rem', display: 'none' }}>
          <div id="resultText"></div>
        </div>
      </div>

      {/* 관리자 섹션 */}
      <div id="adminSection" className={`hidden ${isAdminMode ? '' : 'hidden'}`}>
        <button className="btn btn-back" id="adminBackBtn" onClick={goBackUp}>← 이름 입력으로 돌아가기</button>
        <h2 style={{color: '#2196F3'}}>📊 투표 현황 (ADMIN)</h2>
        <p style={{fontSize: '0.9rem', color: '#666', marginBottom: '1rem'}}>총 투표 수: <b>{votes.length}</b> 표</p>

        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-title">1 팀 (대한민국) 승</div>
            <div className="stat-value" id="countHome">{votes.filter(v => v.result === 'home').length}</div>
          </div>
          <div className="stat-card">
            <div className="stat-title">무승부</div>
            <div className="stat-value" id="countDraw">{votes.filter(v => v.result === 'draw').length}</div>
          </div>
          <div className="stat-card">
            <div className="stat-title">2 팀 (체코) 승</div>
            <div className="stat-value" id="countAway">{votes.filter(v => v.result === 'away').length}</div>
          </div>
          <div className="stat-card">
            <div className="stat-title">평균 총 득점</div>
            <div className="stat-value" id="avgScore">
              {votes.length > 0 
                ? (votes.reduce((acc, cur) => acc + cur.score1 + cur.score2, 0) / votes.length).toFixed(1) 
                : '0.0'}
            </div>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th>이름</th>
              <th>결과</th>
              <th>점수 (1 팀 - 2 팀)</th>
              <th>시간</th>
            </tr>
          </thead>
          <tbody id="adminTableBody">
            {votes.length === 0 ? (
              <tr><td colspan="4" style={{textAlign:'center', color:'#999'}}>등록된 투표가 없습니다.</td></tr>
            ) : (
              votes.map((vote) => {
                let resultText = '';
                if (vote.result === 'home') resultText = '1 팀 승';
                else if (vote.result === 'away') resultText = '2 팀 승';
                else resultText = '무승부';

                const timeStr = vote.created_at ? new Date(vote.created_at).toLocaleString() : '-';

                return (
                  <tr key={vote.id}>
                    <td>{escapeHtml(vote.name)}</td>
                    <td>{resultText}</td>
                    <td>{vote.score1} - {vote.score2}</td>
                    <td>{timeStr}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>

        <button className="btn btn-reset" id="resetBtn" onClick={resetData}>데이터 초기화</button>
      </div>
    </div>
  );
}