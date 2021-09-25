import styled from 'styled-components';
import data from './data.json';
import { useTable, useBlockLayout } from 'react-table';
import { useSticky } from 'react-table-sticky';
import { useEffect, useRef } from 'react';
import { Rows } from './rows';
//import Scroll from 'iscroll/build/iscroll-probe';
import IScroll from './iScroll-min/iScroll';
import Scroll from '@better-scroll/core';
//import Scrollbar from '@better-scroll/scroll-bar';

//Scroll.use(Scrollbar);

let overflow = 'auto';
const groupData = (data) => {
  const groupedData = data.reduce((acc, cur) => {
    if (!acc[cur.age]) acc[cur.age] = [];
    acc[cur.age].push(cur);

    return acc;
  }, {});

  const sortedData = Object.entries(groupedData).sort(
    (entryA, entryB) => entryA[0] - entryB[0]
  );

  const groupCounts = sortedData.map(([key, values]) => values.length + 1);
  const tableData = sortedData
    .map(([key, value]) => {
      return [
        {
          name: key,
          groupRow: true,
        },
        ...value,
      ];
    })
    .flat();

  return { groupCounts, tableData };
};

const columns = [
  // {
  //   Header: 'Age',
  //   accessor: 'age',
  // },
  {
    id: 'name',
    Header: 'Name',
    accessor: 'name',
    sticky: 'left',
    width: 100,
  },
  {
    id: 'email',
    Header: 'email',
    accessor: 'email',
    width: 300,
    //sticky: 'left',
  },
  {
    id: 'name2',
    Header: 'Name 2',
    accessor: 'name',
  },
  {
    id: 'email2',
    Header: 'email 2',
    accessor: 'email',
    width: 300,
  },
  {
    id: 'name3',
    Header: 'Name 3',
    accessor: 'name',
    width: 300,
  },
  {
    id: 'email3',
    Header: 'email 3',
    accessor: 'email',
    width: 300,
  },
];

export const App = () => {
  const { tableData, groupCounts } = groupData(data.slice(0, 100));
  const ref = useRef();
  const vScroller = useRef();
  const headerRef = useRef();
  const { getTableProps, getTableBodyProps, headerGroups, rows, prepareRow } =
    useTable(
      {
        columns,
        data: tableData,
      },
      useBlockLayout,
      useSticky
    );
  useEffect(() => {
    const el = ref.current;
    //iscroll
    const iscroller = new IScroll(el, {
      // disableMouse: true,
      // disablePointer: true,
      // disableTouch: false,
      mouseWheel: true,
      scrollX: true,
      freeScroll: false,
      probeType: 3,
      keyBindings: true,
      eventPassthrough: 'vertical',
      preventDefault: false,
      //bindToWrapper: true,
    });

    iscroller.on('translate', (x, y) => {
      headerRef.current.scrollTo(x, y);
      el.scrollTo(x, y);
      vScroller.current.scrollLeft = x;
      //vScroller.current.scrollTo(x, y);
    });
    vScroller.current.addEventListener('scroll', (event) => {
      const x = vScroller.current.scrollLeft;
      iscroller.scrollTo(x * -1, 0);
    });

    const mql = window.matchMedia('(pointer: coarse)');
    mql.addEventListener('change', (e) => {
      console.log(e.matches);
      // if (e.matches) iscroller.enable();
      // else iscroller.disable();

      if (e.matches) iscroller.enableMouseEvents();
      else iscroller.disableMouseEvents();
    });

    // const scroller = new Scroll(el, {
    //   //disableMouse: false,
    //   mouseWheel: true,
    //   bounce: false,
    //   scrollX: true,
    //   scrollY: false,
    //   freeScroll: false,
    //   probeType: 3,
    //   keyBindings: true,
    //   eventPassthrough: 'vertical',
    //   preventDefault: false,
    //   useTransition: false,
    //   //bindToWrapper: true,
    // });

    // scroller.scroller.translater.hooks.on('translate', (point) => {
    //   const { x, y } = point;
    //   headerRef.current.scrollTo(x * -1, y);
    //   el.scrollTo(x * -1, y);
    // });
    // scroller.on('translate', (x, y) => {
    //   headerRef.current.scrollTo(x * -1, y);
    //   el.scrollTo(x * -1, y);
    // });
  }, [ref]);
  const isTouchDevice =
    'ontouchstart' in window ||
    navigator.maxTouchPoints > 0 ||
    navigator.msMaxTouchPoints > 0;

  // Render the UI for your table
  return (
    <Styles>
      <div style={{ height: 100 }}>
        isTouchDevice:
        {isTouchDevice.toString()}
      </div>
      <div {...getTableProps()} className='table sticky' style={{}}>
        <div className={'header'} ref={headerRef}>
          {headerGroups.map((headerGroup) => (
            <div {...headerGroup.getHeaderGroupProps()} className='tr'>
              {headerGroup.headers.map((column) => (
                <div {...column.getHeaderProps()} className='th'>
                  {column.render('Header')}
                </div>
              ))}
            </div>
          ))}
        </div>
        <div ref={ref} className={'body'} {...getTableBodyProps()}>
          <Rows virtual={true} rows={rows} prepareRow={prepareRow} />
        </div>
        <div
          ref={vScroller}
          style={{ position: 'sticky', bottom: '0', overflow: 'auto' }}
        >
          <div style={{ height: 6, overflow: 'scroll', width: '1450px' }}></div>
        </div>
      </div>
      <div style={{ height: 1000 }}>after table</div>
    </Styles>
  );
};

const Styles = styled.div`
  .table {
    border: 1px solid #ddd;

    .tr {
      :last-child {
        .td {
          border-bottom: 0;
        }
      }
      &.group {
        background-color: wheat;
        position: sticky;
      }
    }

    .th,
    .td {
      padding: 5px;
      border-bottom: 1px solid #ddd;
      border-right: 1px solid #ddd;
      overflow: hidden;

      :last-child {
        border-right: 0;
      }

      .resizer {
        display: inline-block;
        width: 5px;
        height: 100%;
        position: absolute;
        right: 0;
        top: 0;
        transform: translateX(50%);
        z-index: 1;

        &.isResizing {
          background: red;
        }
      }
    }

    &.sticky {
      .header,
      .footer {
        position: sticky;
        z-index: 1;
        width: fit-content;
        overflow: hidden;
      }

      .header {
        top: 0;
        width: 100%;
        background-color: #fff;
        box-shadow: 0px 1px 2px #aaa;
      }

      .footer {
        bottom: 0;
        box-shadow: 0px -3px 3px #ccc;
      }

      .body {
        position: relative;
        z-index: 0;
        overflow-x: hidden;
        overflow-y: hidden;
      }

      .group {
        z-index: 5;
        [data-sticky-td] {
          background-color: wheat;
        }
      }

      [data-sticky-td] {
        position: sticky;
        background-color: #fff;
      }

      [data-sticky-last-left-td] {
        box-shadow: 0px 0px 2px #aaa;
      }

      [data-sticky-first-right-td] {
        box-shadow: -2px 0px 3px #ccc;
      }
    }
  }
`;
