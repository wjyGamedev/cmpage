'use strict';
// +----------------------------------------------------------------------
// | CmPage [ 通用页面框架 ]
// +----------------------------------------------------------------------
// | Licensed under the Apache License, Version 2.0
// +----------------------------------------------------------------------
// | Author: defans <defans@sina.cn>
// +----------------------------------------------------------------------

/**
 单据流转的业务模块，实现了采购、库存管理相关的业务逻辑
 @module docu.model
 */

/**
 * 通用的单据行为实现类，单据保存于表 t_docu,t_order,t_order_apply,t_pay,t_xxxx_rec </br>
 * 相关表：t_goods, t_supplier, t_period,t_period_stock, 参数存于 t_code
 * @class docu.model.docu
 */

const docuRec = require('./docu_rec.js');

module.exports = class extends docuRec {

     /**
      * 增加物料明细，根据模块名称判断数据来源，实现相应的逻辑
      * @method  goodsAdd
      * @return {object} 返回前端的状态对象
      */
    async goodsAdd(fromID, docuID){
        if(think.isEmpty(docuID))  return  {statusCode:300, message:`单据ID错误!`};
        let md = await this.model('vw_order_list').where('rec_id='+fromID).find();
        if(think.isEmpty(md)){
            return  {statusCode:300, message:`采购记录ID不存在!`};
        }
        let fromRec = await this.model('vw_order_list').where(`rec_id=${fromID}`).find();
        let toRec = {
            c_docu:docuID, 
            c_goods:fromRec.c_goods, 
            c_unit:fromRec.c_unit, 
            c_qty: fromRec.c_qty, 
            c_price:fromRec.c_price, 
            c_price_tax:fromRec.c_price_tax,
            c_tax:fromRec.c_tax, 
            c_amt: (fromRec.c_qty - fromRec.c_qty_to) * fromRec.c_price,
            c_amt_tax: (fromRec.c_qty - fromRec.c_qty_to) * fromRec.c_price_tax,
            c_qty_from: fromRec.c_qty - fromRec.c_qty_to,
            c_qty_to:0, 
            c_rec_from: fromRec.c_id,
            c_no_from:fromRec.c_no, 
            c_no_order: fromRec.c_no, 
            c_qty_kp:0, 
            c_close:0, 
            c_supplier:fromRec.c_supplier,
            c_memo:''
        };
        // let sql =`insert into t_docu_rec(c_docu,c_goods,c_unit,c_qty,c_price,c_price_tax,c_tax,c_amt,c_amt_tax,  c_qty_from,c_qty_to,c_rec_from,
        //     c_no_from,c_no_order,c_qty_kp,c_close,c_supplier,c_memo)
        //     select ${docuID},c_goods,c_unit,c_qty - c_qty_to, c_price,c_price_tax,c_tax,(c_qty -c_qty_to)*c_price,(c_qty -c_qty_to)*c_price_tax,
        //     c_qty -c_qty_to, 0,c_id,c_no,c_no, 0,'false',c_supplier,c_memo
        //             from vw_order_list where rec_id =${fromID}  select @@identity as c_id`;
        let recID = await this.model('t_docu_rec').add(toRec);
        if(recID > 0){
            await this.query(`update t_order_rec set c_qty_to=c_qty,c_close =1 where c_id=${fromID}`);
        }
        return  {statusCode:ret.c_id >0 ? 200:300, message: ret.c_id >0 ? "":"操作失败！"};
    }

      /**
       * 删除记录,<br/>
       * 子类中可以重写本方法，实现其他的删除逻辑，如判断是否可以删除，删除相关联的其他记录等等
       * @method  pageDelete
       * @return {object} 记录对象
       */
    //   async pageDelete(){
    //      //删除后需要变动库存数量等
    //      if(this.docuType.id === cmpage.enumDocuType.OrderApply){
    //          await this.model('t_order_apply_rec').where(` c_id=${this.mod.recID}`).delete();
    //      }else if(this.docuType.id === cmpage.enumDocuType.Order){
    //          await this.query(`select fn_order_rec_qty_from_calc(${this.mod.recID},'true');`);
    //      }else if(['DocuCheck','DocuSale','DocuPick','DocuStock','DocuTransfer'].includes(this.docuType.modulename)){
    //          await this.query(`select fn_docu_rec_qty_from_calc('${this.docuType.modulename}',${this.mod.recID},'true');`);
    //      }
    //      //重新计算库存
    //      if(['DocuCheck','DocuSale','DocuPick','DocuStock','DocuTransfer'].includes(this.docuType.modulename)){
    //          let rec = this.model('vw_docu_list').where(`c_id=${this.mod.recID}`).find();
    //          await this.query(`select fn_stock_goods_qty_calc(${rec.c_goods},${rec.c_stock});`);
    //          if(this.docuType.id == cmpage.enumDocuType.DocuTransfer){
    //              await this.query(`perform fn_stock_goods_qty_calc(${rec.c_goods},${rec.c_stock_to});`);
    //          }
    //      }

    //      return {statusCode:200,message:'删除成功！',data:{}};
    //   }

      /**
       * 编辑页面保存,<br/>
       * 根据各种单据类型，增加对保存项的逻辑验证
       * @method  pageSave
       * @return {object} 如果有验证错误，则返回格式： {statusCode:300, message:'xxxxxx'}
       * @param  {object} parms 前端传入的FORM参数
       */
      async pageSave(parms){
        parms = pageSavePretreat(parms);        

        if(parms.c_qty > parms.c_qty_from){
            return {statusCode:300, message:`数量不能大于来源数量: ${parms.c_qty_from}`};
        }
        parms.c_amt = parms.c_qty * parms.c_price;
        parms.c_amt_tax = parms.c_qty * parms.c_price_tax;
        let ret = await super.pageSave(parms);

        //重新计算来源数量，设置是否关闭的标记
        if(parms.c_rec_from >0){
            await this.query(`select fn_docu_rec_qty_from_calc(${this.docuType.modulename}',${parms.c_rec_from},'false');`);
        }
        return ret;

      }

}
