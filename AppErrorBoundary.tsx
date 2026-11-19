import React from 'react';
import {SafeAreaView,StyleSheet,Text,View} from 'react-native';
import {AlertTriangle,RefreshCw} from 'lucide-react-native';
import {MotionPressable} from './Motion';
import {theme} from './theme';

type Props={children:React.ReactNode;onRestart:()=>void};
type State={failed:boolean};
const C=theme.colors;

/**
 * Last-resort render safety net. A screen rendering error should never leave
 * customers or tradespeople facing an unexplained blank white screen.
 * Restart remounts the app's navigation state without changing their account
 * or deleting saved records. Supabase/network errors should still be handled
 * at their source by the individual screen.
 */
export default class AppErrorBoundary extends React.Component<Props,State>{
 state:State={failed:false};
 static getDerivedStateFromError():State{return {failed:true};}
 componentDidCatch(error:Error,info:React.ErrorInfo){
   if(__DEV__)console.error('Tradarr screen render failed:',error,info.componentStack);
 }
 retry=()=>{
   this.setState({failed:false});
   this.props.onRestart();
 };
 render(){
   if(!this.state.failed)return this.props.children;
   return <SafeAreaView style={s.root}>
     <View style={s.card} accessible accessibilityRole="alert">
       <View style={s.icon}><AlertTriangle color={C.coralDark} size={30}/></View>
       <Text style={s.heading}>This screen couldn't load</Text>
       <Text style={s.body}>
         We've hit an unexpected display error. Your saved jobs, messages and
         documents haven't been deleted. Restart the app view to continue.
       </Text>
       <MotionPressable onPress={this.retry} accessibilityRole="button"
         accessibilityLabel="Restart Tradarr view" style={s.button}>
         <RefreshCw size={19} color="#FFFFFF"/>
         <Text style={s.buttonText}>Restart Tradarr view</Text>
       </MotionPressable>
       <Text style={s.footnote}>
         If this happens again, please capture this screen and report it using
         Help & Support in your account after restarting.
       </Text>
     </View>
   </SafeAreaView>;
 }
}
const s=StyleSheet.create({
 root:{flex:1,justifyContent:'center',backgroundColor:C.customerBackground,
    paddingHorizontal:22,paddingVertical:32},
 card:{paddingHorizontal:25,paddingVertical:30,borderRadius:28,backgroundColor:'#FFFFFF',
  borderColor:'#E3EBE8',borderWidth:1,alignItems:'center',...theme.shadow},
 icon:{width:68,height:68,borderRadius:23,backgroundColor:C.coralTint,
   justifyContent:'center',alignItems:'center',marginBottom:18},
 heading:{fontSize:23,fontWeight:'900',color:C.ink,textAlign:'center'},
 body:{fontSize:14,lineHeight:23,color:C.muted,textAlign:'center',marginTop:11},
 button:{minHeight:54,borderRadius:26,backgroundColor:C.darkTeal,marginTop:24,
   width:'100%',alignItems:'center',justifyContent:'center',gap:9,flexDirection:'row'},
 buttonText:{color:'#FFFFFF',fontWeight:'900',fontSize:14},
 footnote:{fontSize:11,lineHeight:18,color:C.muted,textAlign:'center',marginTop:16}
});