import { Component } from 'react';

export default class RoomBoundary extends Component {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error, info) {
    console.error(`[room:${this.props.room || 'unknown'}] render failed`, error, info);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <main className="room-recovery-shell" role="alert">
        <div className="room-recovery-card">
          <span>这间屋子刚刚绊了一下</span>
          <strong>别担心，其他房间还好好的。</strong>
          <div>
            <button type="button" onClick={() => this.setState({ failed: false })}>重新打开</button>
            <button type="button" onClick={this.props.onHome}>回到主页</button>
          </div>
        </div>
      </main>
    );
  }
}
