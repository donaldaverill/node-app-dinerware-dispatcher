'use strict';
var Tedious = require('tedious');
var TediousConnectionPool = require('tedious-connection-pool');
var Promise = require('promise');
var Settings = require('./settings.json');

var dinerware = function (poolConfig, connectionConfig) {
  var _poolConfig = poolConfig;
  var _connectionConfig = connectionConfig;
  this.connectionPool = null;
  if (!!_poolConfig && !!_connectionConfig) {
    this.connectionPool =
      new TediousConnectionPool(_poolConfig, _connectionConfig);
  } else {
    console.log('No configs!');
  }
};

var Dinerware = new dinerware({
  'max': 10,
  'min': 0,
  'idleTimeoutMillis': 30000
}, {
  'userName': Settings.dinerware.username,
  'password': Settings.dinerware.password,
  'server': Settings.dinerware.hostIP,
  'options': {
    'encrypt': false,
    'database': Settings.dinerware.database,
    'rowCollectionOnRequestCompletion': true
  }
});

dinerware.prototype.query = function (id, query) {
  var connectionPool = this.connectionPool;
  return new Promise(function (resolve, reject) {
    if (!connectionPool) {
      reject('no connection pool');
    }
    connectionPool.acquire(function (err, connection) {
      var request = new Tedious.Request(
        query.query,
        function (err, rowCount, rows) {
          if (err) {
            console.log('error in query', err);
            reject(err);
          } else {
            console.log('query results:', query, rows);
            resolve({
              query: query,
              results: rows
            });
          }
          connection.release();
        });
      connection.execSql(request);
    });
  });
};

dinerware.prototype.RFO = function (message, ddpclient) {
  var self = this;
  var RFOQueries = [{
      id: 'allDiscounts',
      query: 'exec dw_daily_site_all_discounts @rcid=-1, @dtstart_time=\'' +
        message.startDate + '\', @dtend_time=\'' + message.endDate + '\''
    }, {
      id: 'salesByRC',
      query: 'exec dw_daily_site_sales_by_revclass @rcid=-1, @dtstart_time=\'' +
        message.startDate + '\', @dtend_time=\'' + message.endDate + '\''
    }, {
      id: 'cashReport',
      query: 'exec dw_daily_site_cash_report @rcid=-1, @dtstart_time=\'' +
        message.startDate + '\', @dtend_time=\'' + message.endDate + '\''
    },
    /*{
        id: 'incomeByRevClass',
        query: 'exec dw_daily_site_income_by_revclass @rcid=-1,' +
        ' @dtstart_time=\'' +
        message.startDate + '\', @dtend_time=\'' + message.endDate + '\''
      }, */
    /*{
        id: 'netSalesByDP',
        query: 'exec dw_daily_site_net_sales_by_daypart @rcid=-1,' +
        ' @dtstart_time=\'' +
        message.startDate + '\', @dtend_time=\'' + message.endDate + '\''
      }, */
    /*{
        id: 'netSalesByRevCenter',
        query: 'exec dw_daily_site_net_sales_by_revenue_center @rcid=-1,' +
        ' @dtstart_time=\'' +
        message.startDate + '\', @dtend_time=\'' + message.endDate + '\''
      }, */
    /*{
        id: 'laborSummary',
        query: 'exec dw_RFO_labor_summary @rcid=-1, @dtstart_time=\'' +
        message.startDate + '\', @dtend_time=\'' + message.endDate + '\''
      }, */
    /*{
        id: 'rfoSummary',
        query: 'exec dw_RFO_summary @rcid=-1, @dtstart_time=\'' +
        message.startDate + '\', @dtend_time=\'' + message.endDate + '\''
      }, */
    {
      id: 'rfoTotals',
      query: 'exec dw_RFO_totals @rcid=-1, @dtstart_time=\'' +
        message.startDate + '\', @dtend_time=\'' + message.endDate + '\''
    }, {
      id: 'taxes',
      query: 'exec dw_daily_site_taxes @rcid=-1, @dtstart_time=\'' +
        message.startDate + '\', @dtend_time=\'' + message.endDate + '\''
    },
    /*{
        id: 'tips',
        query: 'exec dw_daily_site_tips @rcid=-1, @dtstart_time=\'' +
        message.startDate + '\', @dtend_time=\'' + message.endDate + '\''
      },*/
    {
      id: 'transactionsByTender',
      query: 'exec dw_daily_site_transactions_by_tender @rcid=-1,' +
        ' @dtstart_time=\'' +
        message.startDate + '\', @dtend_time=\'' + message.endDate + '\''
    },
    /*{
        id: 'voidsByType',
        query: 'exec dw_daily_site_all_voids_by_type @rcid=-1,' +
        ' @dtstart_time=\'' +
        message.startDate + '\', @dtend_time=\'' + message.endDate + '\''
      }, */
    {
      id: 'cashPaidOut',
      query: 'select * from dwf_daily_site_cash_out_with_reasons (\'' +
        message.startDate + '\', \'' + message.endDate + '\', -1)'
    }, {
      id: 'cashPaidIn',
      query: 'select * from dwf_daily_site_cash_in_with_reasons (\'' +
        message.startDate + '\', \'' + message.endDate + '\', -1)'
    }
  ];
  var results = [];
  RFOQueries.forEach(function (rfoQuery) {
    var result = dinerware.prototype.query.
    call(self, message._id, rfoQuery).then(
      function (response) {
        return response;
      },
      function (error) {
        return error;
      });
    console.log('results : ', result);
    results.push(result);
  });
  Promise.all(results).then(function (res) {
    ddpclient.call('processRFO', [message._id,
        formatRFOResults(message, res)
      ],
      function (err, result) {
        if (err) {
          console.log('[rfoResults.error] : ', err);
        }
      },
      function () {
        console.log('[rfoResults] : done');
      }
    );
  });
};
var formatRFOResults = function (message, results) {
  var returnResults = {};
  returnResults.startDate = message.startDate;
  returnResults.endDate = message.endDate;
  results.forEach(function (result) {
    if (result.query) {
      switch (result.query.id) {
      case 'allDiscounts':
        returnResults.discounts = [];
        result.results.forEach(function (result) {
          returnResults.discounts.push({
            type: result[0].value,
            name: result[1].value,
            count: result[2].value,
            total: result[3].value
          });
        });
        break;
      case 'salesByRC':
        returnResults.sales = [];
        result.results.forEach(function (result) {
          returnResults.sales.push({
            type: result[0].value,
            name: result[1].value,
            net: result[2].value,
            gross: result[3].value,
            qty: result[4].value
          });
        });
        break;
      case 'cashReport':
        returnResults.cash = {
          cashIn: result.results[0][1].value,
          cashOut: result.results[0][2].value,
          cashTotal: result.results[0][3].value,
          tips: result.results[0][4].value,
          change: result.results[0][5].value,
          tipReduction: result.results[0][6].value,
          checks: result.results[0][7].value,
          cashOver: result.results[0][8].value
        };
        break;
      case 'rfoTotals':
        returnResults.totals = {
          chargeback: result.results[0][1].value,
          tansactions: result.results[0][2].value,
          tipReduction: result.results[0][3].value,
          tax: result.results[0][4].value,
          tips: result.results[0][5].value,
          net: result.results[0][6].value,
          netRevenue: result.results[0][7].value,
          netNonRevenue: result.results[0][8].value,
          netPlusTax: result.results[0][9].value,
          receipts: result.results[0][10].value,
          autoDiscounts: result.results[0][11].value,
          manualDiscounts: result.results[0][12].value,
          totalDiscounts: result.results[0][13].value,
          grossNonSales: result.results[0][17].value,
          grossSales: result.results[0][18].value
        };
        break;
      case 'taxes':
        returnResults.taxes = [];
        result.results.forEach(function (result) {
          returnResults.taxes.push({
            name: result[0].value,
            total: result[1].value
          });
        });
        break;
      case 'transactionsByTender':
        returnResults.transactions = [];
        result.results.forEach(function (result) {
          returnResults.transactions.push({
            name: result[1].value,
            total: result[2].value
          });
        });
        break;
      case 'cashPaidOut':
        returnResults.cashOut = [];
        result.results.forEach(function (result) {
          returnResults.cashOut.push({
            name: result[3].value,
            total: result[2].value
          });
        });
        break;
      case 'cashPaidIn':
        returnResults.cashIn = [];
        result.results.forEach(function (result) {
          returnResults.cashIn.push({
            name: result[3].value,
            total: result[2].value
          });
        });
        break;
      default:
        break;
      }
    }
  });
  return returnResults;
};
module.exports = {
  dinerware: Dinerware
};
