import { Component } from 'react';
import { Link } from 'react-router-dom';
export default class HomePreviewBoundary extends Component{
 state={failed:false};
 static getDerivedStateFromError(){return{failed:true};}
 render(){if(!this.state.failed)return this.props.children;const {project,ko}=this.props;return <section className="personal-home-project p-5"><h2>{project.title}</h2><p role="alert" className="my-5 text-sm">{ko?'이 환경에서 작품 미리보기를 열지 못했습니다. 코드를 수정하거나 내 메인 꾸미기에서 기본 화면으로 돌아갈 수 있습니다.':'Preview is unavailable here. Edit the code or restore the default home in settings.'}</p><Link to="/sandbox" state={{sharedCode:project.code,sharedTitle:project.title,homeDraft:true}}>{ko?'코드 열기':'Open code'} →</Link></section>;}
}
